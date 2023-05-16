/**
 * GT_URL can be used to override the URL used for Grafana instances used to run k6 tests.
 * @type {string}
 */
export const url = __ENV.GT_URL || "http://localhost:3000";

/**
 * When using provisioning to set up a larger number of resources for a test, allows scaling a test
 * up and down using the GT_SCALE environment variable normally set to 1.0.
 * When set to 2.0, twice the amount of resources would be created and so forth.
 * @type {number}
 */
export const scale = __ENV.GT_SCALE || 1.0;

import http from "k6/http";
import { loginAdmin } from "./api.js";

// setup runs only once and before the test starts
export function getFrontendSettings() {
    loginAdmin();
    const res = http.get(http.url`${url}/api/frontend/settings`);
    const settings = res.json();
    return {
        buildInfo: settings.buildInfo,
        featureToggles: settings.featureToggles,
    }
}

// returns machine spec passed in by test runner
// provider|model|memory|cores|clockspeed|arch|os
// e.g. local machine = local|m1max|65536/3.2 GHz|arm64|darwin
// e.g. AWS = aws|ec2/m6g.large|512|2|1ghz|amd64|linux
export function getMachineSpec() {
    let parts = (__ENV.MACHINE_SPEC || "").split("|")
    return {
        provider: parts[0],
        model: parts[1],
        memory: parts[2],
        cores: parts[3],
        clockspeed: parts[4],
        arch: parts[5],
        os: parts[6],
    }
}

// return object contianing build info for grafana
// {
    // "branch": "main",
    // "edition": "oss",
    // "goversion": "go1.20.2",
    // "revision": "f70efed2cb",
    // "version"="10.0.0-pre"
// }
export function getGrafanaBuildInfo(){
    // prometheus metrics
    const res = http.get(http.url`${url}/metrics`);

    // find line and parse
    // grafana_build_info{branch="main",edition="oss",goversion="go1.20.2",revision="f70efed2cb",version="10.0.0-pre"} 1
    //console.log("potato", res.body)
    let matches = res.body.match(/(grafana_build_info){(.*)}/)
    // branch="main",edition="oss",goversion="go1.20.2",revision="f70efed2cb",version="10.0.0-pre"
    let keypairs = matches[2]

    let buildInfo = {}
    keypairs.split(",").forEach((kv) => {
        let [key, value] = kv.split("=")

        // no replaceAll in this js environment, so replace twice
        buildInfo[key] = value.replace("\"", "").replace("\"", "")
    })

    return buildInfo
}
