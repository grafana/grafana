// Vendored from the easy-tz library ("07-baked-rules" dist build), converted
// from the published index.mjs + index.d.ts into a single TypeScript module:
// https://github.com/leeoniya/easy-tz/tree/97e8c1695bc2bda4d4fe976085fc90bcad9adfde/dist/07-baked-rules
//
// It lists every IANA zone the runtime supports — plus both spellings of the
// curated canonical/legacy zone pairs, regardless of which one the runtime
// lists — with a DST-correct abbreviation and UTC offset, using pre-baked
// transition rules instead of moment-timezone's bundled tz database. Keep
// edits minimal to ease future syncs with upstream.

export interface TimeZoneInfo {
  /** IANA zone id, e.g. "America/New_York" */
  name: string;
  /** DST-aware abbreviation, e.g. "EST" / "EDT" (not "GMT-5" where avoidable) */
  abbr: string;
  /** UTC offset at the requested instant, e.g. "-05:00" */
  offset: string;
  /** canonical id when `name` is a legacy spelling ("Asia/Kolkata") */
  aliasOf?: string;
}

interface ZoneState {
  abbr: string;
  offMin: number;
}

interface TransitionRule {
  month: number;
  nth: number;
  dow: number;
  atMin: number;
  to: number;
}

interface StaticClass {
  zones: string[];
  kind: 0;
  states: [ZoneState];
}

interface RulesClass {
  zones: string[];
  kind: 1;
  states: [ZoneState, ZoneState];
  rules: [TransitionRule, TransitionRule];
}

interface IrregularClass {
  zones: string[];
  kind: 2;
  starts: number[];
  abbrs: string[];
  offMins: number[];
}

type ScheduleClass = StaticClass | RulesClass | IrregularClass;

// shared/zoneLinks.ts
const zoneLinkPairs: Array<[canonical: string, alias: string]> = [
  ['Africa/Asmara', 'Africa/Asmera'],
  ['America/Argentina/Buenos_Aires', 'America/Buenos_Aires'],
  ['America/Argentina/Catamarca', 'America/Catamarca'],
  ['America/Argentina/Cordoba', 'America/Cordoba'],
  ['America/Argentina/Jujuy', 'America/Jujuy'],
  ['America/Argentina/Mendoza', 'America/Mendoza'],
  ['America/Atikokan', 'America/Coral_Harbour'],
  ['America/Indiana/Indianapolis', 'America/Indianapolis'],
  ['America/Kentucky/Louisville', 'America/Louisville'],
  ['America/Nuuk', 'America/Godthab'],
  ['Asia/Ho_Chi_Minh', 'Asia/Saigon'],
  ['Asia/Kathmandu', 'Asia/Katmandu'],
  ['Asia/Kolkata', 'Asia/Calcutta'],
  ['Asia/Ulaanbaatar', 'Asia/Choibalsan'],
  ['Asia/Yangon', 'Asia/Rangoon'],
  ['Atlantic/Faroe', 'Atlantic/Faeroe'],
  ['Europe/Kyiv', 'Europe/Kiev'],
  ['Pacific/Chuuk', 'Pacific/Truk'],
  ['Pacific/Kanton', 'Pacific/Enderbury'],
  ['Pacific/Pohnpei', 'Pacific/Ponape'],
];

const zoneLinks = new Map<string, string>();
const aliasOfZone = new Map<string, string>();
for (const [canonical, alias] of zoneLinkPairs) {
  zoneLinks.set(canonical, alias);
  zoneLinks.set(alias, canonical);
  aliasOfZone.set(alias, canonical);
}

function makeInfo(name: string, abbr: string, offset: string): TimeZoneInfo {
  const aliasOf = aliasOfZone.get(name);
  return aliasOf === undefined ? { name, abbr, offset } : { name, abbr, offset, aliasOf };
}

// shared/zones.ts
const runtimeZones = Intl.supportedValuesOf('timeZone');
const zones = (() => {
  const set = new Set(runtimeZones);
  for (const [canonical, alias] of zoneLinkPairs) {
    set.add(canonical);
    set.add(alias);
  }
  return set.size === runtimeZones.length ? runtimeZones : [...set].sort();
})();

// shared/decode.ts
function decodeZone(prefixes: string[], z: string): string {
  return prefixes[parseInt(z[0], 36)] + z.slice(1);
}

const decodeZones = (prefixes: string[], packed: string): string[] =>
  packed.split(';').map((z) => decodeZone(prefixes, z));

function decodeSchedule(
  prefixesPacked: string,
  staticsPacked: string,
  rulesPacked: string,
  irregularsPacked: string
): ScheduleClass[] {
  const prefixes = prefixesPacked.split('|');
  const out: ScheduleClass[] = [];
  if (staticsPacked !== '') {
    for (const c of staticsPacked.split('|')) {
      const [zs, abbr, offMin] = c.split('~');
      out.push({ zones: decodeZones(prefixes, zs), kind: 0, states: [{ abbr, offMin: +offMin }] });
    }
  }
  if (rulesPacked !== '') {
    for (const c of rulesPacked.split('|')) {
      const [zs, s0, s1, r0, r1] = c.split('~');
      const state = (s: string): ZoneState => {
        const cut = s.lastIndexOf(',');
        return { abbr: s.slice(0, cut), offMin: +s.slice(cut + 1) };
      };
      const rule = (r: string): TransitionRule => {
        const [month, nth, dow, atMin, to] = r.split(',').map(Number);
        return { month, nth, dow, atMin, to };
      };
      out.push({
        zones: decodeZones(prefixes, zs),
        kind: 1,
        states: [state(s0), state(s1)],
        rules: [rule(r0), rule(r1)],
      });
    }
  }
  if (irregularsPacked !== '') {
    for (const c of irregularsPacked.split('|')) {
      const [zs, starts, abbrs, offMins] = c.split('~');
      out.push({
        zones: decodeZones(prefixes, zs),
        kind: 2,
        starts: starts.split(',').map(Number),
        abbrs: abbrs.split(','),
        offMins: offMins.split(',').map(Number),
      });
    }
  }
  return out;
}

// shared/tables/chrome/schedule.ts
const YEAR_START = 1767225600000;
const STEP_MS = 900000;
const P =
  'America/|Asia/|Europe/|Africa/|Pacific/|Indian/|Antarctica/|Australia/|Atlantic/|America/Argentina/|America/Indiana/|America/North_Dakota/|Arctic/|America/Kentucky/';
const S =
  '3Abidjan;3Accra;3Bamako;3Banjul;3Bissau;3Conakry;3Dakar;3Freetown;3Lome;3Monrovia;3Nouakchott;3Ouagadougou;3Sao_Tome;0Danmarkshavn;8Reykjavik;8St_Helena~GMT~0|3Addis_Ababa;3Asmera;3Dar_es_Salaam;3Djibouti;3Kampala;3Mogadishu;3Nairobi;5Antananarivo;5Comoro;5Mayotte~EAT~180|3Algiers;3Tunis~CET~60|3Bangui;3Brazzaville;3Douala;3Kinshasa;3Lagos;3Libreville;3Luanda;3Malabo;3Ndjamena;3Niamey;3Porto-Novo~WAT~60|3Blantyre;3Bujumbura;3Gaborone;3Harare;3Juba;3Khartoum;3Kigali;3Lubumbashi;3Lusaka;3Maputo;3Windhoek~CAT~120|3Johannesburg;3Maseru;3Mbabane~SAST~120|3Tripoli;2Kaliningrad~EET~120|0Anguilla;0Antigua;0Aruba;0Barbados;0Blanc-Sablon;0Curacao;0Dominica;0Grenada;0Guadeloupe;0Kralendijk;0Lower_Princes;0Marigot;0Martinique;0Montserrat;0Port_of_Spain;0Puerto_Rico;0Santo_Domingo;0St_Barthelemy;0St_Kitts;0St_Lucia;0St_Thomas;0St_Vincent;0Tortola~AST~-240|0Araguaina;0Bahia;0Belem;0Fortaleza;0Maceio;0Recife;0Santarem;0Sao_Paulo~BRT~-180|9La_Rioja;9Rio_Gallegos;9Salta;9San_Juan;9San_Luis;9Tucuman;9Ushuaia;0Buenos_Aires;0Catamarca;0Cordoba;0Jujuy;0Mendoza~ART~-180|0Asuncion~PYT~-180|0Bahia_Banderas;0Belize;0Chihuahua;0Costa_Rica;0El_Salvador;0Guatemala;0Managua;0Merida;0Mexico_City;0Monterrey;0Regina;0Swift_Current;0Tegucigalpa~CST~-360|0Boa_Vista;0Campo_Grande;0Cuiaba;0Manaus;0Porto_Velho~AMT~-240|0Bogota~COT~-300|0Cancun;0Cayman;0Coral_Harbour;0Jamaica;0Panama~EST~-300|0Caracas~VET~-240|0Cayenne~GFT~-180|0Coyhaique;0Punta_Arenas;6Palmer~GMT-3~-180|0Creston;0Dawson;0Dawson_Creek;0Fort_Nelson;0Hermosillo;0Mazatlan;0Phoenix;0Whitehorse~MST~-420|0Eirunepe;0Rio_Branco~ACT~-300|0Guayaquil~ECT~-300|0Guyana~GYT~-240|0La_Paz~BOT~-240|0Lima~PET~-300|0Montevideo~UYT~-180|0Noronha~FNT~-120|0Paramaribo~SRT~-180|6Casey;7Perth~AWST~480|6Davis~DAVT~420|6DumontDUrville~DUT~600|6Mawson~MAWT~300|6Rothera~ROTT~-180|6Syowa~SYOT~180|6Vostok~VOST~300|1Aden;1Baghdad;1Bahrain;1Kuwait;1Qatar;1Riyadh~AST~180|1Almaty;1Aqtau;1Aqtobe;1Atyrau;1Oral;1Qostanay;1Qyzylorda~KT~300|1Amman;1Damascus~GMT+3~180|1Anadyr;1Kamchatka~KST~720|1Ashgabat~TMT~300|1Baku~AZT~240|1Bangkok;1Phnom_Penh;1Saigon;1Vientiane~ICT~420|1Barnaul;1Krasnoyarsk;1Novokuznetsk;1Novosibirsk;1Tomsk~KRAT~420|1Bishkek~KGT~360|1Brunei~BT~480|1Calcutta;1Colombo~IST~330|1Chita;1Khandyga;1Yakutsk~YAKT~540|1Dhaka~BST~360|1Dili~TLT~540|1Dubai;1Muscat~GST~240|1Dushanbe~TJT~300|1Hong_Kong~HKT~480|1Hovd~KST~420|1Irkutsk~IRKT~480|1Jakarta;1Pontianak~WIB~420|1Jayapura~WIT~540|1Kabul~AFT~270|1Karachi~PKT~300|1Katmandu~NPT~345|1Kuala_Lumpur;1Kuching~MYT~480|1Macau;1Shanghai~CST~480|1Magadan;1Sakhalin;1Srednekolymsk~MAGT~660|1Makassar~WITA~480|1Manila~PST~480|1Omsk~OMST~360|1Pyongyang;1Seoul~KST~540|1Rangoon~MMT~390|1Samarkand;1Tashkent~UZT~300|1Singapore~SGT~480|1Taipei~TST~480|1Tbilisi~GET~240|1Tehran~IRST~210|1Thimphu~BTT~360|1Tokyo~JST~540|1Ulaanbaatar~ULAT~480|1Urumqi~GMT+6~360|1Ust-Nera;1Vladivostok~VLAT~600|1Yekaterinburg~YEKT~300|1Yerevan~AMT~240|8Cape_Verde~CVT~-60|8South_Georgia~GST~-120|8Stanley~FKST~-180|7Brisbane;7Lindeman~AEST~600|7Darwin~ACST~570|7Eucla~ACWST~525|2Astrakhan;2Samara;2Saratov;2Ulyanovsk~SAMT~240|2Istanbul~TRT~180|2Kirov;2Minsk;2Moscow;2Simferopol;2Volgograd~MSK~180|5Chagos~IOT~360|5Christmas~CXT~420|5Cocos~CCT~390|5Kerguelen~TFT~300|5Mahe~SCT~240|5Maldives~MVT~300|5Mauritius~MUT~240|5Reunion~RET~240|4Apia~SST~780|4Bougainville~GMT+11~660|4Efate~VUT~660|4Enderbury~PHOT~780|4Fakaofo~TKT~780|4Fiji~FJT~720|4Funafuti~TVT~720|4Galapagos~GALT~-360|4Gambier~GAMT~-540|4Guadalcanal~SBT~660|4Guam;4Saipan~ChST~600|4Honolulu~HST~-600|4Kiritimati~LINT~840|4Kosrae~KOST~660|4Kwajalein;4Majuro~MHT~720|4Marquesas~MART~-570|4Midway;4Pago_Pago~SST~-660|4Nauru~NRT~720|4Niue~NUT~-660|4Noumea~NCT~660|4Palau~PWT~540|4Pitcairn~PT~-480|4Ponape~PT~660|4Port_Moresby~PGT~600|4Rarotonga~CKT~-600|4Tahiti~TAHT~-600|4Tarawa~GILT~720|4Tongatapu~TOT~780|4Truk~CHUT~600|4Wake~WAKT~720|4Wallis~WFT~720';
const R =
  '3Cairo~EET,120~EEST,180~4,5,5,0,1~10,5,5,0,0|3Ceuta;cLongyearbyen;2Amsterdam;2Andorra;2Belgrade;2Berlin;2Bratislava;2Brussels;2Budapest;2Busingen;2Copenhagen;2Gibraltar;2Ljubljana;2Luxembourg;2Madrid;2Malta;2Monaco;2Oslo;2Paris;2Podgorica;2Prague;2Rome;2San_Marino;2Sarajevo;2Skopje;2Stockholm;2Tirane;2Vaduz;2Vatican;2Vienna;2Warsaw;2Zagreb;2Zurich~CET,60~CEST,120~3,5,0,120,1~10,5,0,180,0|0Adak~HST,-600~HDT,-540~3,2,0,120,1~11,1,0,120,0|0Anchorage;0Juneau;0Metlakatla;0Nome;0Sitka;0Yakutat~AKST,-540~AKDT,-480~3,2,0,120,1~11,1,0,120,0|0Boise;0Cambridge_Bay;0Ciudad_Juarez;0Denver;0Edmonton;0Inuvik~MST,-420~MDT,-360~3,2,0,120,1~11,1,0,120,0|0Chicago;aKnox;aTell_City;0Matamoros;0Menominee;bBeulah;bCenter;bNew_Salem;0Ojinaga;0Rankin_Inlet;0Resolute;0Winnipeg~CST,-360~CDT,-300~3,2,0,120,1~11,1,0,120,0|0Detroit;0Grand_Turk;aMarengo;aPetersburg;aVevay;aVincennes;aWinamac;0Indianapolis;0Iqaluit;dMonticello;0Louisville;0Nassau;0New_York;0Port-au-Prince;0Toronto~EST,-300~EDT,-240~3,2,0,120,1~11,1,0,120,0|0Glace_Bay;0Goose_Bay;0Halifax;0Moncton;0Thule;8Bermuda~AST,-240~ADT,-180~3,2,0,120,1~11,1,0,120,0|0Godthab;0Scoresbysund~GST,-120~GST,-60~3,5,6,1380,1~10,5,0,0,0|0Havana~CST,-300~CDT,-240~3,2,0,0,1~11,1,0,60,0|0Los_Angeles;0Tijuana;0Vancouver~PST,-480~PDT,-420~3,2,0,120,1~11,1,0,120,0|0Miquelon~PMST,-180~PMDT,-120~3,2,0,120,1~11,1,0,120,0|0Santiago~CLST,-180~CLT,-240~4,1,0,0,1~9,1,0,0,0|0St_Johns~NST,-210~NDT,-150~3,2,0,120,1~11,1,0,120,0|6Macquarie;7Hobart;7Melbourne;7Sydney~AEDT,660~AEST,600~4,1,0,180,1~10,1,0,120,0|6McMurdo;4Auckland~NZDT,780~NZST,720~4,1,0,180,1~9,5,0,120,0|6Troll~GMT,0~GMT+2,120~3,5,0,60,1~10,5,0,180,0|1Beirut~EET,120~EEST,180~3,5,0,0,1~10,5,0,0,0|1Famagusta;1Nicosia;2Athens;2Bucharest;2Helsinki;2Kiev;2Mariehamn;2Riga;2Sofia;2Tallinn;2Vilnius~EET,120~EEST,180~3,5,0,180,1~10,5,0,240,0|1Jerusalem~IST,120~IDT,180~3,4,5,120,1~10,5,0,120,0|8Azores~AZOT,-60~AZOST,0~3,5,0,0,1~10,5,0,60,0|8Canary;8Faeroe;8Madeira;2Lisbon~WET,0~WEST,60~3,5,0,60,1~10,5,0,120,0|7Adelaide;7Broken_Hill~ACDT,630~ACST,570~4,1,0,180,1~10,1,0,120,0|7Lord_Howe~LHDT,660~LHST,630~4,1,0,120,1~10,1,0,120,0|2Chisinau~EET,120~EEST,180~3,5,0,120,1~10,5,0,180,0|2Dublin~GMT,0~IST,60~3,5,0,60,1~10,5,0,120,0|2Guernsey;2Isle_of_Man;2Jersey;2London~GMT,0~BST,60~3,5,0,60,1~10,5,0,120,0|4Chatham~CHADT,825~CHAST,765~4,1,0,225,1~9,5,0,165,0|4Easter~EASST,-300~EAST,-360~4,1,6,1320,1~9,1,6,1320,0|4Norfolk~NFDT,720~NFT,660~4,1,0,180,1~10,1,0,120,0';
const I =
  '3Casablanca;3El_Aaiun~0,4328,7688~GMT+1,GMT,GMT+1~60,0,60|1Gaza;1Hebron~0,8256,28412~EET,EEST,EET~120,180,120';
const scheduleClasses = decodeSchedule(P, S, R, I);

// shared/rules.ts
function buildScheduleIndex(zoneList: string[], classes: ScheduleClass[]): number[] {
  const idxOf = new Map<string, number>();
  for (let i = 0; i < classes.length; i++) {
    for (const z of classes[i].zones) {
      idxOf.set(z, i);
    }
  }
  return zoneList.map((z) => idxOf.get(z) ?? idxOf.get(zoneLinks.get(z) ?? '') ?? -1);
}

function ruleInstant(year: number, rule: TransitionRule, offBeforeMin: number): number {
  let day: number;
  if (rule.nth === 5) {
    const daysInMonth = new Date(Date.UTC(year, rule.month, 0)).getUTCDate();
    const lastDow = new Date(Date.UTC(year, rule.month - 1, daysInMonth)).getUTCDay();
    day = daysInMonth - ((lastDow - rule.dow + 7) % 7);
  } else {
    const firstDow = new Date(Date.UTC(year, rule.month - 1, 1)).getUTCDay();
    day = 1 + ((rule.dow - firstDow + 7) % 7) + (rule.nth - 1) * 7;
  }
  return Date.UTC(year, rule.month - 1, day) + (rule.atMin - offBeforeMin) * 60000;
}

function resolveClass(cls: ScheduleClass, ts: number, yearStart: number, stepMs: number): ZoneState {
  if (cls.kind === 0) {
    return cls.states[0];
  }
  if (cls.kind === 1) {
    const year = new Date(ts).getUTCFullYear();
    const [r1, r2] = cls.rules;
    const t1 = ruleInstant(year, r1, cls.states[1 - r1.to].offMin);
    const t2 = ruleInstant(year, r2, cls.states[1 - r2.to].offMin);
    if (ts < t1) {
      return cls.states[r2.to];
    }
    if (ts < t2) {
      return cls.states[r1.to];
    }
    return cls.states[r2.to];
  }
  const step = Math.max(0, Math.floor((ts - yearStart) / stepMs));
  let i = cls.starts.length - 1;
  while (i > 0 && cls.starts[i] > step) {
    i--;
  }
  return { abbr: cls.abbrs[i], offMin: cls.offMins[i] };
}

// shared/fmt.ts
function formatOffsetMinutes(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const abs = min < 0 ? -min : min;
  const hh = String((abs / 60) | 0).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

// shared/hourCache.ts
const HOUR_MS = 3600000;
function hourBucketMemo(compute: (timestamp: number) => TimeZoneInfo[]) {
  let lastBucket = NaN;
  let lastResult: TimeZoneInfo[] = [];
  return {
    get(timestamp: number): TimeZoneInfo[] {
      const bucket = Math.floor(timestamp / HOUR_MS);
      if (bucket !== lastBucket) {
        lastResult = compute(bucket * HOUR_MS);
        lastBucket = bucket;
      }
      return lastResult;
    },
    clear() {
      lastBucket = NaN;
      lastResult = [];
    },
  };
}

// impls/07-baked-rules/index.ts
const classIdx = buildScheduleIndex(zones, scheduleClasses);
const offsetStrCache = new Map<number, string>();
function offsetStr(offMin: number): string {
  let s = offsetStrCache.get(offMin);
  if (s === undefined) {
    s = formatOffsetMinutes(offMin);
    offsetStrCache.set(offMin, s);
  }
  return s;
}
function compute(timestamp: number): TimeZoneInfo[] {
  const nClasses = scheduleClasses.length;
  const abbrNow = new Array<string>(nClasses);
  const offsetNow = new Array<string>(nClasses);
  for (let c = 0; c < nClasses; c++) {
    const st = resolveClass(scheduleClasses[c], timestamp, YEAR_START, STEP_MS);
    abbrNow[c] = st.abbr;
    offsetNow[c] = offsetStr(st.offMin);
  }
  const out: TimeZoneInfo[] = [];
  for (let z = 0; z < zones.length; z++) {
    const c = classIdx[z];
    out.push(c < 0 ? makeInfo(zones[z], 'UTC', '+00:00') : makeInfo(zones[z], abbrNow[c], offsetNow[c]));
  }
  return out;
}
const memo = hourBucketMemo(compute);

/**
 * All IANA zones known to the runtime (sorted by name) with their
 * DST-correct abbreviation and UTC offset at `timestamp` (epoch ms).
 * Results are memoized per UTC hour bucket and returned by reference —
 * treat them as immutable.
 */
export const getTimeZonesAt = memo.get;

/**
 * Drops the hour-bucket memo so the next call recomputes (first-call
 * init/verification work is NOT redone). Only needed when the result
 * arrays were mutated or in test/bench harnesses.
 */
// export const clearCache = memo.clear;
