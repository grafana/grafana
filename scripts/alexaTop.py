#/usr/bin/python

#############################################################
# Adds Raintank Monitors to collect metrics from the Alexa
# Top list of sites.
# python alexaTop100.py --count 10 --key <AWS KEY>  \
#    --secret <AWS SECRET> --user <Raintank User> 
#    --password <Raintank Password> --site=<SiteId> --delete
#
#
# - Anthony Woods <awoods@raintank.io>
#############################################################

import sys
import requests
import json
import argparse
import base64
import hmac
import hashlib
import datetime
import urllib
from lxml import etree

parser = argparse.ArgumentParser(description='Raintank Alexa Top 100 Monitors.')
parser.add_argument('--count', dest='count', type=int, default=10)
parser.add_argument('--site', dest='site', type=int, default=1)
parser.add_argument('--key', dest='key', type=str, required=True)
parser.add_argument('--secret', dest='secret', type=str, required=True)
parser.add_argument('--delete', dest='delete', action='store_true', help="remote monitors for sites that are no longer in the list.")
parser.add_argument('--endpoint', dest='endpoint', default="https://portal.raintank.io")
parser.add_argument('--user', dest='user', default="admin")
parser.add_argument('--password', dest='password', default="admin")

args = parser.parse_args()


class AlexaTopSites(object):
    def __init__(self, key=None, secret=None):
        self.key = key
        self.secret = secret
        self.host = 'ats.amazonaws.com'

    def fetch(self, count=None):
        params = self.getQueryParams(count=count)
        url = "http://%s/" % self.host
        r = requests.get(url, params=params)
        if r.status_code != requests.codes.ok:
            raise Exception("Request to ats.amazonaws.com failed.")
        sites = []
        root = etree.fromstring(r.content)
        namespaces = { "aws": 'http://ats.amazonaws.com/doc/2005-11-21'}
        for site in root.xpath('//aws:Response/aws:TopSitesResult/aws:Alexa/aws:TopSites/aws:Country/aws:Sites/aws:Site/aws:DataUrl', namespaces=namespaces):
            sites.append(site.text)
        return sites

    def getQueryParams(self, count=None):
        if count is None:
            count = 10
        now = datetime.datetime.utcnow()
        params = {
            "AWSAccessKeyId": self.key,
            "Action": "TopSites",
            "Count": "%d" % count,
            "CountryCode": "US",
            "ResponseGroup": "Country",
            "SignatureMethod": "HmacSHA256",
            "SignatureVersion": "2",
            "Start": "1",
            "Timestamp": now.isoformat() + 'Z',
        }
        params["Signature"] = self.getSignature(params)
        return params

    def getSignature(self, params):
        stringToSign = "GET\n%s\n/\n" % self.host
        paramArray = []
        for k,v in iter(sorted(params.items())):
            paramArray.append("%s=%s" % (urllib.quote(k, safe='-_~'), urllib.quote(v, safe='-_~')))

        stringToSign = stringToSign + '&'.join(paramArray)

        sig = hmac.new(self.secret, (stringToSign).encode('utf-8'), hashlib.sha256).digest()

        return base64.encodestring( sig ).strip()


class RaintankApi(object):

    def __init__(self, endpoint=None, user=None, password=None):
        self.endpoint = endpoint
        self.user = user
        self.password = password
        self.cookie = None

    def authenticate(self):
        params = {
            "user": self.user,
            "password": self.password
        }
        r = requests.post("%s/login" % self.endpoint, data=params)
        if r.status_code != requests.codes.ok:
            raise Exception("Failed to log into %s", self.endpoint)
        self.cookie = r.cookies["grafana_sess"]

    def request(self, method="GET", path="/", **kwargs):
        if self.cookie is None:
            self.authenticate()
        url = "%s%s" % (self.endpoint, path)
        cookies = kwargs.get("cookies", {})
        cookies['grafana_sess'] = self.cookie
        return requests.request(method,  url, cookies=cookies, **kwargs)

    def getSite(self, siteId):
        r = self.request("GET", "/api/sites/%s" % siteId)
        if r.status_code != requests.codes.ok:
            raise Exception("Request for site failed.")
        return r.json()

    def getMonitors(self, filter=None):
        if filter is None:
            filter = {}
        r = self.request("GET", "/api/monitors", params=filter)
        if r.status_code != requests.codes.ok:
            raise Exception("Request for monitors failed.")
        return r.json()

    def deleteMonitor(self, monitorId):
        r = self.request("DELETE", "/api/monitors/%s" % monitorId)
        if r.status_code != requests.codes.ok:
            raise Exception("Request for monitors failed.")
        return True

    def addMonitor(self, monitor):
        r = self.request("PUT", "/api/monitors/", data=json.dumps(monitor), headers={"Content-Type": "application/json"})
        if r.status_code != requests.codes.ok:
            print r.text
            raise Exception("Failed to add monitor.")
        return r.json()

raintank = RaintankApi(args.endpoint, args.user, args.password)
site = raintank.getSite(args.site)
monitors = raintank.getMonitors(filter={"site_id": args.site})

monitorMap = {}
seenSites = {}

for monitor in monitors:
    monitorMap[monitor['name']] = monitor

alexa = AlexaTopSites(args.key, args.secret)
sites = alexa.fetch(args.count)

for site in sites:
    siteName = site.split('.', 2)[0].capitalize()
    print "siteName: %s" % siteName
    if siteName not in monitorMap:
        print "No monitor for %s" % siteName
        monitor = {
            "site_id": args.site,
            "frequency": 10,
            "locations": [1,2,3,4,5,6,7,8,9,10],
            "monitor_type_id": 1,
            "name": siteName,
            "settings": [
                {"variable": "host", "value": site},
                {"variable": "path", "value": '/'},
            ]
        }
        r = raintank.addMonitor(monitor)
        print r

    seenSites[siteName] = True

if args.delete:
    print "removing sites not in the list"
    for mon in monitors:
        if mon['name'] not in seenSites:
            print "%s is not in the alexa list." % mon['name']
            raintank.deleteMonitor(mon['id'])


