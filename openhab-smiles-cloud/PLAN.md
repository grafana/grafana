# openHAB S-Miles Cloud Binding — Design Plan

## Overview

An openHAB binding that connects to the Hoymiles S-Miles Cloud (`neapi.hoymiles.com`) to read
real-time data from solar inverters (Wechselrichter). Modeled after the existing Home Assistant
integrations (Philra94/homeassistant-hoymiles-cloud, wil-lem/ha-hoymiles-s-cloud) and the
ioBroker.hoymiles adapter (Eistee82/ioBroker.hoymiles).

## Architecture

```
Bridge: SMilesCloudAccount
  ├── config: username, password, baseUrl, pollingInterval
  ├── handles: authentication (v3 Argon2 + fallbacks), token lifecycle
  └── discovery: auto-discovers stations after login

Thing: SMilesCloudStation
  ├── config: stationId
  ├── static channels: station-level aggregate data
  └── dynamic channels: per-PV-string V/I/P (created after first data fetch)
```

## Authentication

All three auth flows must be supported (tried in order):

### 1. V3 Argon2id (current standard, mandatory since 2026)

```
POST /iam/pub/3/auth/pre-insp  {"u": "<email>"}
  → {a: "<hex_salt>", n: "<nonce>"}

Compute: argon2id(password, salt, t=3, m=32768, p=1, hashLen=32) → hex

POST /iam/pub/3/auth/login  {"u": "<email>", "ch": "<hex_hash>", "n": "<nonce>"}
  → {data: {token: "..."}}
```

### 2. V3 unsalted fallback (when pre-insp returns a=null)

Two variants tried in sequence:
- sha256_v3: `md5(password).hex() + "." + base64(sha256(password))`
- sha256_hex_v3: `sha256(password).hex()`

### 3. Legacy V0 (MD5, may be deprecated)

```
POST /iam/pub/0/auth/login  {"user_name": "<email>", "password": "<md5_hex>"}
  → {data: {token: "..."}}
```

Token goes in `Authorization` header (raw, no Bearer prefix). TTL ~2 hours.

## Argon2 Library: Bouncy Castle (pure Java)

**Decision: Use Bouncy Castle `bcprov-jdk18on` (pure Java), not `argon2-jvm` (JNI).**

| Criteria | Bouncy Castle | argon2-jvm |
|---|---|---|
| Native code required | No (pure Java) | Yes (JNA → C lib) |
| OSGi compatible | Yes (existing openHAB bundles use it) | Problematic (JNI loading in OSGi) |
| Already in openHAB | Yes (used by boschshc, homekit, etc.) | No |
| Platform support | Any JVM | Needs native lib per platform |
| Performance | ~1.2s for m=32768 | ~0.3s (native) |
| Correctness | Verified: matches argon2-cffi output | N/A |

The 1.2s Argon2 computation happens only at login (every ~2 hours), not per polling
cycle, so the performance difference is irrelevant.

**Verified cross-language hash match:**
```
Password: testpassword123
Salt: d5e3f019748d7a36d69840fdfd873d15
Params: Argon2id, t=3, m=32768, p=1, hashLen=32
Python (argon2-cffi): 3c5d1ece590f242aa94b901f3940ebfd89b7bd0fdd21132a69e4321d6436a409
Java (Bouncy Castle): 3c5d1ece590f242aa94b901f3940ebfd89b7bd0fdd21132a69e4321d6436a409
```

## API Endpoints

All POST, JSON body, base URL `https://neapi.hoymiles.com`.

| Purpose | Path | Payload |
|---|---|---|
| Login v0 | `/iam/pub/0/auth/login` | `{user_name, password}` |
| Pre-inspect v3 | `/iam/pub/3/auth/pre-insp` | `{u}` |
| Login v3 | `/iam/pub/3/auth/login` | `{u, ch, n}` |
| List stations | `/pvm/api/0/station/select_by_page` | `{page_size, page_num}` |
| Station detail | `/pvm/api/0/station/find` | `{id}` |
| Real-time data | `/pvm-data/api/0/station/data/count_station_real_data` | `{sid}` |
| PV indicators | `/pvm-data/api/0/indicators/data/select_real_indicators_data` | `{sid, type: 4}` |
| Microinverters | `/pvm/api/0/dev/micro/select_by_station` | `{sid, page_size, page_num}` |
| Micro detail | `/pvm/api/0/dev/micro/find` | `{id, sid}` |
| Device tree | `/pvm/api/0/station/select_device_of_tree` | `{id}` |
| Power limit | `/pvm-ctl/api/0/dev/command/put` | `{action:8, data:{sid, power_limit, enable:1}}` |

## Channels

### Station-level (from count_station_real_data)

| Channel ID | Type | Unit | API field |
|---|---|---|---|
| pvPower | Number:Power | W | real_power |
| todayEnergy | Number:Energy | Wh | today_eq |
| monthEnergy | Number:Energy | Wh | month_eq |
| yearEnergy | Number:Energy | Wh | year_eq |
| totalEnergy | Number:Energy | Wh | total_eq |
| co2Reduction | Number:Mass | g | co2_emission_reduction |
| gridPower | Number:Power | W | reflux_station_data.grid_power |
| loadPower | Number:Power | W | reflux_station_data.load_power |
| batteryPower | Number:Power | W | reflux_station_data.bms_power |
| batterySoc | Number:Dimensionless | % | reflux_station_data.bms_soc |
| gridImportToday | Number:Energy | Wh | reflux_station_data.meter_b_in_eq |
| gridExportToday | Number:Energy | Wh | reflux_station_data.meter_b_out_eq |
| batteryChargeToday | Number:Energy | Wh | reflux_station_data.bms_in_eq |
| batteryDischargeToday | Number:Energy | Wh | reflux_station_data.bms_out_eq |
| consumptionToday | Number:Energy | Wh | reflux_station_data.use_eq_total |
| pvToLoadToday | Number:Energy | Wh | reflux_station_data.pv_to_load_eq |
| gridImportTotal | Number:Energy | Wh | reflux_station_data.mb_in_eq.total_eq |
| gridExportTotal | Number:Energy | Wh | reflux_station_data.mb_out_eq.total_eq |
| lastUpdate | DateTime | — | data_time |
| powerLimit | Number:Dimensionless | % | config.power_limit (writable) |

### Dynamic PV string channels (from select_real_indicators_data)

Created after first data fetch, per detected PV input (1-4 depending on inverter model):

| Channel ID pattern | Type | Unit | API key |
|---|---|---|---|
| pv{N}Voltage | Number:ElectricPotential | V | {N}_pv_v |
| pv{N}Current | Number:ElectricCurrent | A | {N}_pv_i |
| pv{N}Power | Number:Power | W | {N}_pv_p |
| pvTotalPower | Number:Power | W | pv_p_total |

## Project Structure

```
openhab-smiles-cloud/
├── pom.xml
├── README.md
├── PLAN.md
├── src/main/
│   ├── java/org/openhab/binding/smilescloud/internal/
│   │   ├── SMilesCloudBindingConstants.java
│   │   ├── SMilesCloudHandlerFactory.java
│   │   ├── SMilesCloudBridgeHandler.java
│   │   ├── SMilesCloudStationHandler.java
│   │   ├── api/
│   │   │   ├── SMilesCloudApiClient.java
│   │   │   ├── SMilesCloudAuthService.java
│   │   │   └── dto/
│   │   │       ├── StationData.java
│   │   │       ├── StationRealTimeData.java
│   │   │       ├── PvIndicators.java
│   │   │       └── AuthResponse.java
│   │   ├── config/
│   │   │   ├── SMilesCloudBridgeConfig.java
│   │   │   └── SMilesCloudStationConfig.java
│   │   └── discovery/
│   │       └── SMilesCloudStationDiscovery.java
│   └── resources/OH-INF/
│       ├── addon/addon.xml
│       ├── thing/bridge.xml
│       └── thing/station.xml
└── src/test/java/org/openhab/binding/smilescloud/internal/
    ├── api/
    │   ├── SMilesCloudAuthServiceTest.java
    │   └── SMilesCloudApiClientTest.java
    └── SMilesCloudStationHandlerTest.java
```

## Test Plan

### Unit Tests (automated, run without network)

1. **Auth hash computation tests**
   - Argon2id with salt → verify hex output matches known reference
   - Unsalted sha256_v3 variant → verify md5.base64(sha256) format
   - Unsalted sha256_hex_v3 variant → verify plain sha256 hex
   - Legacy v0 MD5 → verify md5 hex
   - Salt decoding: hex salt, base64 salt, raw salt

2. **API response parsing tests**
   - Parse station list response → extract id/name map
   - Parse real-time data → extract all channel values
   - Parse PV indicators → discover channel count, extract V/I/P values
   - Parse error responses (status != "0") → handle gracefully
   - Parse empty/null fields → return null, not crash

3. **Auth flow orchestration tests** (mocked HTTP)
   - v3 with Argon2 salt → success
   - v3 unsalted, first variant succeeds → success
   - v3 unsalted, first variant fails, second succeeds → success
   - All v3 fail, legacy v0 succeeds → success
   - All fail → proper error reporting
   - Token expiry detection and re-auth

4. **Station handler tests**
   - Channel state updates from parsed data
   - Dynamic PV channel creation
   - Null/missing data handling
   - Polling lifecycle (start/stop)

### Integration Tests (automated, mocked HTTP server)

5. **Full polling cycle test**
   - Mock HTTP server returns station list + real-time data + PV indicators
   - Verify bridge goes ONLINE, station discovered, channels populated
   - Simulate token expiry → verify re-auth and recovery

6. **Error recovery tests**
   - API returns 401 → re-authenticate
   - API returns 500 → station goes OFFLINE, retries
   - Network timeout → station goes OFFLINE with COMMUNICATION_ERROR

### Manual Verification (requires real S-Miles account)

7. **Live auth flow**
   - Configure bridge with real credentials
   - Verify bridge goes ONLINE
   - Check logs for auth method used (v3 argon2 vs fallback)

8. **Live data flow**
   - Verify stations discovered automatically
   - Verify channel values match S-Miles Cloud web UI
   - Verify PV string channels created for correct number of inputs
   - Wait for polling cycle, verify values update
   - Check at night (0W production) → values should be 0, not null

9. **Power limit control** (if available)
   - Set power limit via openHAB
   - Verify change reflected in S-Miles Cloud web UI

### Test Execution Without Real Hardware

Since we don't have a real S-Miles account, testing follows this strategy:

1. **All unit tests** run with mocked HTTP responses based on real API
   response structures observed in the HA integrations' test suites.

2. **Auth hash verification** is already done (see cross-language test above).

3. **Response parsing** uses fixture data matching the JSON structures from
   Philra94's test_hoymiles_api.py and the ioBroker adapter's state definitions.

4. **Integration test with mock HTTP** simulates the full bridge→station→channel
   flow end-to-end without needing real credentials.

## Phases

### Phase 1 (MVP)
- Bridge with v3 auth (Argon2 + fallbacks) + legacy v0
- Station thing with all channels listed above
- Dynamic PV string channels
- Station discovery
- Power limit control (writable channel)
- Unit + integration tests

### Phase 2
- Microinverter as child Things (serial, model, firmware as properties)
- Battery mode control (Select channel)
- Battery reserve SOC (Number channel, writable)
- DTU online/offline binary sensor

### Phase 3
- Battery schedule editor (Economy/Time-of-Use)
- Peak shaving settings
- Station info as Thing properties (GPS, address, timezone)
