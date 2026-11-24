#!/usr/bin/env python3
"""Load the report-layout showcase into a running Grafana.

Creates the testdata data source the dashboards query (as the default data source), creates or
updates every dashboard in this folder through the v2 API, and seeds the annotations each one
narrates. Annotations are placed relative to now, so they line up with the dashboards' relative
time ranges; re-run the script to move them to the present.

    python3 devenv/dev-dashboards/dashboard-report-layouts/load.py --url http://localhost:3000
"""
import argparse
import base64
import glob
import json
import os
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
TESTDATA_UID = "PD8C576611E62080A"

# The changes each dashboard narrates, in minutes relative to now. Each dashboard shows the
# annotations carrying its tag through a tag-filtered annotation query.
ANNOTATIONS = [
    {"tags": ["report-checkout"], "minutes": -312, "text": "search: index rebuild started"},
    {"tags": ["report-checkout"], "minutes": -134, "text": "payments v4.12.0 deployed (card-token validation)"},
    {"tags": ["report-checkout"], "minutes": -96, "text": "Alert: payments error budget exhausted"},
    {"tags": ["report-checkout"], "minutes": -41, "text": "Rollback proposed in #checkout-oncall"},
    {"tags": ["report-rollout"], "minutes": -330, "text": "v2 canary at 1%"},
    {"tags": ["report-rollout"], "minutes": -250, "text": "Step to 5%"},
    {"tags": ["report-rollout"], "minutes": -170, "text": "Step to 25%: cold cache"},
    {"tags": ["report-rollout"], "minutes": -90, "text": "Step to 50%"},
    {"tags": ["report-product"], "minutes": -79200, "text": "Pricing change"},
    {"tags": ["report-product"], "minutes": -57600, "text": "New onboarding flow"},
    {"tags": ["report-fleet"], "minutes": -7200, "text": "batch config change (spool rotation)"},
    {"tags": ["report-fleet"], "minutes": -300, "text": "edge-02 drained for patching"},
    {"tags": ["report-incident"], "minutes": -150, "text": "v4.12.0 deploys"},
    {"tags": ["report-incident"], "minutes": -143, "text": "Budget-burn alert pages on-call"},
    {"tags": ["report-incident"], "minutes": -131, "text": "Rollback fails"},
    {"tags": ["report-incident"], "minutes": -104, "text": "Validation flag off"},
    {"tags": ["report-incident"], "minutes": -150, "durationMinutes": 58, "text": "Customer impact"},
    {"tags": ["report-release"], "minutes": -8640, "text": "Feature freeze"},
    {"tags": ["report-release"], "minutes": -2880, "text": "Release candidate 1"},
]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://localhost:3000")
    parser.add_argument("--user", default="admin")
    parser.add_argument("--password", default="admin")
    args = parser.parse_args()
    client = Client(args.url.rstrip("/"), args.user, args.password)

    ensure_testdata(client)
    for path in sorted(glob.glob(os.path.join(HERE, "*.json"))):
        with open(path) as f:
            doc = json.load(f)
        upsert_dashboard(client, doc)
        print(f"dashboard  {doc['metadata']['name']}: {doc['spec']['title']}")

    seed_annotations(client, ANNOTATIONS)


class Client:
    def __init__(self, url, user, password):
        self.url = url
        self.auth = "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()

    def request(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.url + path, data=data, method=method)
        req.add_header("Authorization", self.auth)
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as res:
                text = res.read()
                return res.status, json.loads(text) if text else None
        except urllib.error.HTTPError as err:
            text = err.read()
            return err.code, json.loads(text) if text else None


def ensure_testdata(client):
    status, _ = client.request("GET", f"/api/datasources/uid/{TESTDATA_UID}")
    if status == 200:
        return
    status, body = client.request("POST", "/api/datasources", {
        "name": "gdev-testdata", "type": "grafana-testdata-datasource", "access": "proxy",
        "uid": TESTDATA_UID, "isDefault": True,
    })
    if status >= 300:
        raise SystemExit(f"could not create the testdata data source: {status} {body}")
    print("datasource gdev-testdata")


def upsert_dashboard(client, doc):
    name = doc["metadata"]["name"]
    base = "/apis/dashboard.grafana.app/v2/namespaces/default/dashboards"
    status, existing = client.request("GET", f"{base}/{name}")
    if status == 200:
        doc = {**doc, "metadata": {"name": name, "resourceVersion": existing["metadata"]["resourceVersion"]}}
        status, body = client.request("PUT", f"{base}/{name}", doc)
    else:
        status, body = client.request("POST", base, doc)
    if status >= 300:
        raise SystemExit(f"could not save {name}: {status} {body.get('message') if body else ''}")


def seed_annotations(client, entries):
    tags = sorted({tag for entry in entries for tag in entry["tags"]})
    for tag in tags:
        _, existing = client.request("GET", f"/api/annotations?tags={tag}&limit=500")
        for annotation in existing or []:
            client.request("DELETE", f"/api/annotations/{annotation['id']}")

    now = int(time.time() * 1000)
    for entry in entries:
        body = {"time": now + int(entry["minutes"] * 60_000), "tags": entry["tags"], "text": entry["text"]}
        if "durationMinutes" in entry:
            body["timeEnd"] = body["time"] + int(entry["durationMinutes"] * 60_000)
        status, res = client.request("POST", "/api/annotations", body)
        if status >= 300:
            raise SystemExit(f"could not create annotation: {status} {res}")
    print(f"annotations {len(entries)} across {', '.join(tags)}")


if __name__ == "__main__":
    main()
