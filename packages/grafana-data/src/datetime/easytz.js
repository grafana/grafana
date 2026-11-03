/* eslint-disable */
// Vendored from easy-tz (07-baked-rules) at commit 0cc5e9f9c46ec65e9056754d194180ee5bbf656f:
// https://github.com/leeoniya/easy-tz/tree/0cc5e9f9c46ec65e9056754d194180ee5bbf656f/dist/07-baked-rules
// plus a generator fix (settling kind-2 zones keep their historical eras) pending upstream;
// tables regenerated with `bun run gen && bun run build` (Bun 1.4.0) against chrome-headless-shell 156.0.8078.80
// (tzdata 2026e: permanent offsets for BC, Alberta, NWT, Manitoba; Morocco permanent +00).

// shared/zoneLinks.ts
var zoneLinkPairs = [
  ["Africa/Asmara", "Africa/Asmera"],
  ["America/Argentina/Buenos_Aires", "America/Buenos_Aires"],
  ["America/Argentina/Catamarca", "America/Catamarca"],
  ["America/Argentina/Cordoba", "America/Cordoba"],
  ["America/Argentina/Jujuy", "America/Jujuy"],
  ["America/Argentina/Mendoza", "America/Mendoza"],
  ["America/Atikokan", "America/Coral_Harbour"],
  ["America/Indiana/Indianapolis", "America/Indianapolis"],
  ["America/Kentucky/Louisville", "America/Louisville"],
  ["America/Nuuk", "America/Godthab"],
  ["Asia/Ho_Chi_Minh", "Asia/Saigon"],
  ["Asia/Kathmandu", "Asia/Katmandu"],
  ["Asia/Kolkata", "Asia/Calcutta"],
  ["Asia/Ulaanbaatar", "Asia/Choibalsan"],
  ["Asia/Yangon", "Asia/Rangoon"],
  ["Atlantic/Faroe", "Atlantic/Faeroe"],
  ["Europe/Kyiv", "Europe/Kiev"],
  ["Pacific/Chuuk", "Pacific/Truk"],
  ["Pacific/Kanton", "Pacific/Enderbury"],
  ["Pacific/Pohnpei", "Pacific/Ponape"]
];
var zoneLinks = new Map;
var aliasOfZone = new Map;
for (const [canonical, alias] of zoneLinkPairs) {
  zoneLinks.set(canonical, alias);
  zoneLinks.set(alias, canonical);
  aliasOfZone.set(alias, canonical);
}
function canonicalZone(name) {
  return aliasOfZone.get(name) ?? name;
}
function canonicalView() {
  let lastFull = null;
  let lastCanon = [];
  return (full) => {
    if (full !== lastFull) {
      lastFull = full;
      lastCanon = full.filter((z) => z.aliasOf == null);
    }
    return lastCanon;
  };
}
var internPool = new Map;
var POOL_NAME_CAP = 4096;
function freezeInfo(name, abbr, offset) {
  const aliasOf = aliasOfZone.get(name);
  return Object.freeze(aliasOf == null ? { name, abbr, offset } : { name, abbr, offset, aliasOf });
}
function makeInfo(name, abbr, offset) {
  let byOffset = internPool.get(name);
  if (byOffset == null) {
    if (internPool.size >= POOL_NAME_CAP)
      return freezeInfo(name, abbr, offset);
    internPool.set(name, byOffset = new Map);
  }
  let byAbbr = byOffset.get(offset);
  if (byAbbr == null)
    byOffset.set(offset, byAbbr = new Map);
  let info = byAbbr.get(abbr);
  if (info == null)
    byAbbr.set(abbr, info = freezeInfo(name, abbr, offset));
  return info;
}

// shared/zones.ts
var runtimeZones = Intl.supportedValuesOf("timeZone");
var zones = (() => {
  const set = new Set(runtimeZones);
  for (const [canonical, alias] of zoneLinkPairs) {
    set.add(canonical);
    set.add(alias);
  }
  return set.size === runtimeZones.length ? runtimeZones : [...set].sort();
})();

// shared/decode.ts
function decodeZone(prefixes, z) {
  return prefixes[parseInt(z[0], 36)] + z.slice(1);
}
var decodeZones = (prefixes, packed) => packed.split(";").map((z) => decodeZone(prefixes, z));
function zonesByIndex(zs, zoneList) {
  const out = [];
  for (let i = 0;i < zs.length; i += 2) {
    out.push(zoneList[parseInt(zs.slice(i, i + 2), 36)]);
  }
  return out;
}
function decodeSchedule(prefixesPacked, staticsPacked, rulesPacked, irregularsPacked) {
  const prefixes = prefixesPacked.split("|");
  const out = [];
  if (staticsPacked !== "") {
    for (const c of staticsPacked.split("|")) {
      const [zs, abbr, offMin] = c.split("~");
      out.push({ zones: decodeZones(prefixes, zs), kind: 0, states: [{ abbr, offMin: +offMin }] });
    }
  }
  if (rulesPacked !== "") {
    for (const c of rulesPacked.split("|")) {
      const [zs, s0, s1, r0, r1] = c.split("~");
      const state = (s) => {
        const cut = s.lastIndexOf(",");
        return { abbr: s.slice(0, cut), offMin: +s.slice(cut + 1) };
      };
      const rule = (r) => {
        const [month, nth, dow, atMin, to] = r.split(",").map(Number);
        return { month, nth, dow, atMin, to };
      };
      out.push({
        zones: decodeZones(prefixes, zs),
        kind: 1,
        states: [state(s0), state(s1)],
        rules: [rule(r0), rule(r1)]
      });
    }
  }
  if (irregularsPacked !== "") {
    for (const c of irregularsPacked.split("|")) {
      const [zs, starts, abbrs, offMins] = c.split("~");
      out.push({
        zones: decodeZones(prefixes, zs),
        kind: 2,
        starts: starts.split(",").map(Number),
        abbrs: abbrs.split(","),
        offMins: offMins.split(",").map(Number)
      });
    }
  }
  return out;
}
function decodeHistory(zoneList, pairsPacked, tuplesPacked, erasPacked, classesPacked, fromYearBase) {
  if (classesPacked === "")
    return [];
  const pairs = pairsPacked.split("|").map((p) => p.split(",").map((v) => +v * 15));
  const dict = erasPacked.split("|");
  const tupleRule = (i, to) => {
    const o = i * 6;
    return {
      month: parseInt(tuplesPacked[o], 36),
      nth: parseInt(tuplesPacked[o + 1], 36),
      dow: parseInt(tuplesPacked[o + 2], 36),
      atMin: parseInt(tuplesPacked.slice(o + 3, o + 6), 36),
      to
    };
  };
  const decodeEra = (fromYear, p) => {
    const type = p[0];
    const payload = p.slice(1);
    if (type === "d")
      return { fromYear, kind: 3, offs: [], rules: null, steps: null };
    if (type === "s")
      return { fromYear, kind: 0, offs: [+payload * 15], rules: null, steps: null };
    if (type === "r") {
      const [qA, qB] = pairs[parseInt(payload.slice(0, 2), 36)];
      return {
        fromYear,
        kind: 1,
        offs: [qA, qB],
        rules: [
          tupleRule(parseInt(payload.slice(2, 4), 36), 1),
          tupleRule(parseInt(payload.slice(4, 6), 36), 0)
        ],
        steps: null
      };
    }
    const steps = [];
    const offs = [];
    for (const seg of payload.split(",")) {
      steps.push(parseInt(seg.slice(0, 3), 36));
      offs.push(+seg.slice(3) * 15);
    }
    return { fromYear, kind: 2, offs, rules: null, steps };
  };
  return classesPacked.split("|").map((c) => {
    const cut = c.indexOf("~");
    const zs = c.slice(0, cut);
    const es = c.slice(cut + 1);
    const zones2 = zonesByIndex(zs, zoneList);
    const eras = [];
    for (let i = 0;i < es.length; i += 3) {
      eras.push(decodeEra(fromYearBase + parseInt(es[i], 36), dict[parseInt(es.slice(i + 1, i + 3), 36)]));
    }
    return { zones: zones2, eras };
  });
}
var ABBRFIX_OFF_BIAS = 48;
function decodeAbbrFix(zoneList, dictPacked, classesPacked, fromYearBase, stepMs) {
  if (classesPacked === "")
    return [];
  const dict = dictPacked.split(",");
  const base = Date.UTC(fromYearBase, 0, 1);
  return classesPacked.split("|").map((c) => {
    const [zs, rangesPacked, spansPacked] = c.split("~");
    const zones2 = zonesByIndex(zs, zoneList);
    const fromYear = [];
    const toYear = [];
    const offs = [];
    const abbrs = [];
    if (rangesPacked !== "") {
      for (const r of rangesPacked.split(";")) {
        const f = r.split(",");
        const y = fromYearBase + parseInt(f[0], 36);
        fromYear.push(y);
        toYear.push(y + parseInt(f[1], 36));
        offs.push((parseInt(f[2], 36) - ABBRFIX_OFF_BIAS) * 15);
        abbrs.push(dict[parseInt(f[3], 36)]);
      }
    }
    const spanFrom = [];
    const spanTo = [];
    const spanAbbrs = [];
    let step = 0;
    if (spansPacked !== "") {
      for (const s of spansPacked.split(";")) {
        const f = s.split(",");
        step += parseInt(f[0], 36);
        spanFrom.push(base + step * stepMs);
        step += parseInt(f[1], 36);
        spanTo.push(base + step * stepMs);
        spanAbbrs.push(dict[parseInt(f[2], 36)]);
      }
    }
    return { zones: zones2, fromYear, toYear, offs, abbrs, spanFrom, spanTo, spanAbbrs };
  });
}

// shared/tables/chrome/schedule.ts
var YEAR_START = 1767225600000;
var STEP_MS = 900000;
var P = "America/|Asia/|Europe/|Africa/|Pacific/|Indian/|Antarctica/|Australia/|Atlantic/|America/Argentina/|America/Indiana/|America/North_Dakota/|Arctic/|America/Kentucky/";
var S = "3Abidjan;3Accra;3Bamako;3Banjul;3Bissau;3Conakry;3Dakar;3Freetown;3Lome;3Monrovia;3Nouakchott;3Ouagadougou;3Sao_Tome;0Danmarkshavn;8Reykjavik;8St_Helena~GMT~0|3Addis_Ababa;3Asmera;3Dar_es_Salaam;3Djibouti;3Kampala;3Mogadishu;3Nairobi;5Antananarivo;5Comoro;5Mayotte~EAT~180|3Algiers;3Tunis~CET~60|3Bangui;3Brazzaville;3Douala;3Kinshasa;3Lagos;3Libreville;3Luanda;3Malabo;3Ndjamena;3Niamey;3Porto-Novo~WAT~60|3Blantyre;3Bujumbura;3Gaborone;3Harare;3Juba;3Khartoum;3Kigali;3Lubumbashi;3Lusaka;3Maputo;3Windhoek~CAT~120|3Johannesburg;3Maseru;3Mbabane~SAST~120|3Tripoli;2Kaliningrad~EET~120|0Anguilla;0Antigua;0Aruba;0Barbados;0Blanc-Sablon;0Curacao;0Dominica;0Grenada;0Guadeloupe;0Kralendijk;0Lower_Princes;0Marigot;0Martinique;0Montserrat;0Port_of_Spain;0Puerto_Rico;0Santo_Domingo;0St_Barthelemy;0St_Kitts;0St_Lucia;0St_Thomas;0St_Vincent;0Tortola~AST~-240|0Araguaina;0Bahia;0Belem;0Fortaleza;0Maceio;0Recife;0Santarem;0Sao_Paulo~BRT~-180|9La_Rioja;9Rio_Gallegos;9Salta;9San_Juan;9San_Luis;9Tucuman;9Ushuaia;0Buenos_Aires;0Catamarca;0Cordoba;0Jujuy;0Mendoza~ART~-180|0Asuncion~PYT~-180|0Bahia_Banderas;0Belize;0Chihuahua;0Costa_Rica;0El_Salvador;0Guatemala;0Managua;0Merida;0Mexico_City;0Monterrey;0Regina;0Swift_Current;0Tegucigalpa~CST~-360|0Boa_Vista;0Campo_Grande;0Cuiaba;0Manaus;0Porto_Velho~AMT~-240|0Bogota~COT~-300|0Cancun;0Cayman;0Coral_Harbour;0Jamaica;0Panama~EST~-300|0Caracas~VET~-240|0Cayenne~GFT~-180|0Coyhaique;0Punta_Arenas;6Palmer~GMT-3~-180|0Creston;0Dawson;0Dawson_Creek;0Fort_Nelson;0Hermosillo;0Mazatlan;0Phoenix;0Whitehorse~MST~-420|0Eirunepe;0Rio_Branco~ACT~-300|0Guayaquil~ECT~-300|0Guyana~GYT~-240|0La_Paz~BOT~-240|0Lima~PET~-300|0Montevideo~UYT~-180|0Noronha~FNT~-120|0Paramaribo~SRT~-180|6Casey;7Perth~AWST~480|6Davis~DAVT~420|6DumontDUrville~DUT~600|6Mawson~MAWT~300|6Rothera~ROTT~-180|6Syowa~SYOT~180|6Vostok~VOST~300|1Aden;1Baghdad;1Bahrain;1Kuwait;1Qatar;1Riyadh~AST~180|1Almaty;1Aqtau;1Aqtobe;1Atyrau;1Oral;1Qostanay;1Qyzylorda~KT~300|1Amman;1Damascus~GMT+3~180|1Anadyr;1Kamchatka~KST~720|1Ashgabat~TMT~300|1Baku~AZT~240|1Bangkok;1Phnom_Penh;1Saigon;1Vientiane~ICT~420|1Barnaul;1Krasnoyarsk;1Novokuznetsk;1Novosibirsk;1Tomsk~KRAT~420|1Bishkek~KGT~360|1Brunei~BT~480|1Calcutta;1Colombo~IST~330|1Chita;1Khandyga;1Yakutsk~YAKT~540|1Dhaka~BST~360|1Dili~TLT~540|1Dubai;1Muscat~GST~240|1Dushanbe~TJT~300|1Hong_Kong~HKT~480|1Hovd~KST~420|1Irkutsk~IRKT~480|1Jakarta;1Pontianak~WIB~420|1Jayapura~WIT~540|1Kabul~AFT~270|1Karachi~PKT~300|1Katmandu~NPT~345|1Kuala_Lumpur;1Kuching~MYT~480|1Macau;1Shanghai~CST~480|1Magadan;1Sakhalin;1Srednekolymsk~MAGT~660|1Makassar~WITA~480|1Manila~PST~480|1Omsk~OMST~360|1Pyongyang;1Seoul~KST~540|1Rangoon~MMT~390|1Samarkand;1Tashkent~UZT~300|1Singapore~SGT~480|1Taipei~TST~480|1Tbilisi~GET~240|1Tehran~IRST~210|1Thimphu~BTT~360|1Tokyo~JST~540|1Ulaanbaatar~ULAT~480|1Urumqi~GMT+6~360|1Ust-Nera;1Vladivostok~VLAT~600|1Yekaterinburg~YEKT~300|1Yerevan~AMT~240|8Cape_Verde~CVT~-60|8South_Georgia~GST~-120|8Stanley~FKST~-180|7Brisbane;7Lindeman~AEST~600|7Darwin~ACST~570|7Eucla~ACWST~525|2Astrakhan;2Samara;2Saratov;2Ulyanovsk~SAMT~240|2Istanbul~TRT~180|2Kirov;2Minsk;2Moscow;2Simferopol;2Volgograd~MSK~180|5Chagos~IOT~360|5Christmas~CXT~420|5Cocos~CCT~390|5Kerguelen~TFT~300|5Mahe~SCT~240|5Maldives~MVT~300|5Mauritius~MUT~240|5Reunion~RET~240|4Apia~SST~780|4Bougainville~GMT+11~660|4Efate~VUT~660|4Enderbury~PHOT~780|4Fakaofo~TKT~780|4Fiji~FJT~720|4Funafuti~TVT~720|4Galapagos~GALT~-360|4Gambier~GAMT~-540|4Guadalcanal~SBT~660|4Guam;4Saipan~ChST~600|4Honolulu~HST~-600|4Kiritimati~LINT~840|4Kosrae~KOST~660|4Kwajalein;4Majuro~MHT~720|4Marquesas~MART~-570|4Midway;4Pago_Pago~SST~-660|4Nauru~NRT~720|4Niue~NUT~-660|4Noumea~NCT~660|4Palau~PWT~540|4Pitcairn~PT~-480|4Ponape~PT~660|4Port_Moresby~PGT~600|4Rarotonga~CKT~-600|4Tahiti~TAHT~-600|4Tarawa~GILT~720|4Tongatapu~TOT~780|4Truk~CHUT~600|4Wake~WAKT~720|4Wallis~WFT~720";
var R = "3Cairo~EET,120~EEST,180~4,5,5,0,1~10,5,5,0,0|3Ceuta;cLongyearbyen;2Amsterdam;2Andorra;2Belgrade;2Berlin;2Bratislava;2Brussels;2Budapest;2Busingen;2Copenhagen;2Gibraltar;2Ljubljana;2Luxembourg;2Madrid;2Malta;2Monaco;2Oslo;2Paris;2Podgorica;2Prague;2Rome;2San_Marino;2Sarajevo;2Skopje;2Stockholm;2Tirane;2Vaduz;2Vatican;2Vienna;2Warsaw;2Zagreb;2Zurich~CET,60~CEST,120~3,5,0,120,1~10,5,0,180,0|0Adak~HST,-600~HDT,-540~3,2,0,120,1~11,1,0,120,0|0Anchorage;0Juneau;0Metlakatla;0Nome;0Sitka;0Yakutat~AKST,-540~AKDT,-480~3,2,0,120,1~11,1,0,120,0|0Boise;0Cambridge_Bay;0Ciudad_Juarez;0Denver~MST,-420~MDT,-360~3,2,0,120,1~11,1,0,120,0|0Chicago;aKnox;aTell_City;0Matamoros;0Menominee;bBeulah;bCenter;bNew_Salem;0Ojinaga;0Rankin_Inlet;0Resolute~CST,-360~CDT,-300~3,2,0,120,1~11,1,0,120,0|0Detroit;0Grand_Turk;aMarengo;aPetersburg;aVevay;aVincennes;aWinamac;0Indianapolis;0Iqaluit;dMonticello;0Louisville;0Nassau;0New_York;0Port-au-Prince;0Toronto~EST,-300~EDT,-240~3,2,0,120,1~11,1,0,120,0|0Glace_Bay;0Goose_Bay;0Halifax;0Moncton;0Thule;8Bermuda~AST,-240~ADT,-180~3,2,0,120,1~11,1,0,120,0|0Godthab;0Scoresbysund~GST,-120~GST,-60~3,5,6,1380,1~10,5,0,0,0|0Havana~CST,-300~CDT,-240~3,2,0,0,1~11,1,0,60,0|0Los_Angeles;0Tijuana~PST,-480~PDT,-420~3,2,0,120,1~11,1,0,120,0|0Miquelon~PMST,-180~PMDT,-120~3,2,0,120,1~11,1,0,120,0|0Santiago~CLST,-180~CLT,-240~4,1,0,0,1~9,1,0,0,0|0St_Johns~NST,-210~NDT,-150~3,2,0,120,1~11,1,0,120,0|6Macquarie;7Hobart;7Melbourne;7Sydney~AEDT,660~AEST,600~4,1,0,180,1~10,1,0,120,0|6McMurdo;4Auckland~NZDT,780~NZST,720~4,1,0,180,1~9,5,0,120,0|6Troll~GMT,0~GMT+2,120~3,5,0,60,1~10,5,0,180,0|1Beirut~EET,120~EEST,180~3,5,0,0,1~10,5,0,0,0|1Famagusta;1Nicosia;2Athens;2Bucharest;2Chisinau;2Helsinki;2Kiev;2Mariehamn;2Riga;2Sofia;2Tallinn;2Vilnius~EET,120~EEST,180~3,5,0,180,1~10,5,0,240,0|1Jerusalem~IST,120~IDT,180~3,4,5,120,1~10,5,0,120,0|8Azores~AZOT,-60~AZOST,0~3,5,0,0,1~10,5,0,60,0|8Canary;8Faeroe;8Madeira;2Lisbon~WET,0~WEST,60~3,5,0,60,1~10,5,0,120,0|7Adelaide;7Broken_Hill~ACDT,630~ACST,570~4,1,0,180,1~10,1,0,120,0|7Lord_Howe~LHDT,660~LHST,630~4,1,0,120,1~10,1,0,120,0|2Dublin~GMT,0~IST,60~3,5,0,60,1~10,5,0,120,0|2Guernsey;2Isle_of_Man;2Jersey;2London~GMT,0~BST,60~3,5,0,60,1~10,5,0,120,0|4Chatham~CHADT,825~CHAST,765~4,1,0,225,1~9,5,0,165,0|4Easter~EASST,-300~EAST,-360~4,1,6,1320,1~9,1,6,1320,0|4Norfolk~NFDT,720~NFT,660~4,1,0,180,1~10,1,0,120,0";
var I = "3Casablanca;3El_Aaiun~0,4328,7688,25156~GMT+1,GMT,GMT+1,WET~60,0,60,0|0Edmonton;0Inuvik~0,6372~MST,MDT~-420,-360|0Vancouver~0,6376~PST,PDT~-480,-420|0Winnipeg~0,6368~CST,CDT~-360,-300|1Gaza;1Hebron~0,8256,28412~EET,EEST,EET~120,180,120";
var scheduleClasses = decodeSchedule(P, S, R, I);

// shared/fmt.ts
function gmtLabel(offMin) {
  if (offMin === 0)
    return "GMT";
  const sign = offMin < 0 ? "-" : "+";
  const abs = offMin < 0 ? -offMin : offMin;
  const h = Math.trunc(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m > 0 ? `:${String(m).padStart(2, "0")}` : ""}`;
}

// shared/rules.ts
function buildScheduleIndex(zoneList, classes) {
  const idxOf = new Map;
  for (let i = 0;i < classes.length; i++) {
    for (const z of classes[i].zones)
      idxOf.set(z, i);
  }
  return zoneList.map((z) => idxOf.get(z) ?? idxOf.get(zoneLinks.get(z) ?? "") ?? -1);
}
var DAY_MS = 86400000;
var MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var isLeap = (y) => y % 4 === 0 && y % 100 !== 0 || y % 400 === 0;
var daysInMonth = (y, m) => m === 2 && isLeap(y) ? 29 : MONTH_DAYS[m - 1];
function daysFromCivil(y, m, d) {
  const yy = y - (m <= 2 ? 1 : 0);
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
var dowFromCivil = (y, m, d) => ((daysFromCivil(y, m, d) + 4) % 7 + 7) % 7;
function yearFromMs(ts) {
  let z = Math.floor(ts / DAY_MS) + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  return (mp < 10 ? mp + 3 : mp - 9) <= 2 ? y + 1 : y;
}
function ruleInstant(year, rule, offBeforeMin) {
  let day;
  if (rule.nth === 5) {
    const dim = daysInMonth(year, rule.month);
    const lastDow = dowFromCivil(year, rule.month, dim);
    day = dim - (lastDow - rule.dow + 7) % 7;
  } else {
    const firstDow = dowFromCivil(year, rule.month, 1);
    day = 1 + (rule.dow - firstDow + 7) % 7 + (rule.nth - 1) * 7;
  }
  return daysFromCivil(year, rule.month, day) * DAY_MS + (rule.atMin - offBeforeMin) * 60000;
}
function ruleCycleIndex(off0, off1, r1, r2, year, ts) {
  const t1 = ruleInstant(year, r1, r1.to === 0 ? off1 : off0);
  const t2 = ruleInstant(year, r2, r2.to === 0 ? off1 : off0);
  if (ts < t1)
    return r2.to;
  if (ts < t2)
    return r1.to;
  return r2.to;
}
function segmentIndex(starts, ts, anchor, stepMs) {
  const step = Math.max(0, Math.floor((ts - anchor) / stepMs));
  let i = starts.length - 1;
  while (i > 0 && starts[i] > step)
    i--;
  return i;
}
var transOf = new WeakMap;
var segStatesOf = new WeakMap;
function resolveClass(cls, ts, yearStart, stepMs) {
  if (cls.kind === 0)
    return cls.states[0];
  if (cls.kind === 1) {
    const [r1, r2] = cls.rules;
    const year = yearFromMs(ts);
    let tc = transOf.get(cls);
    if (tc == null)
      transOf.set(cls, tc = { year: NaN, t1: 0, t2: 0 });
    if (tc.year !== year) {
      const off0 = cls.states[0].offMin;
      const off1 = cls.states[1].offMin;
      tc.year = year;
      tc.t1 = ruleInstant(year, r1, r1.to === 0 ? off1 : off0);
      tc.t2 = ruleInstant(year, r2, r2.to === 0 ? off1 : off0);
    }
    return cls.states[ts < tc.t1 ? r2.to : ts < tc.t2 ? r1.to : r2.to];
  }
  let segStates = segStatesOf.get(cls);
  if (segStates == null) {
    segStatesOf.set(cls, segStates = cls.abbrs.map((abbr, s) => ({ abbr, offMin: cls.offMins[s] })));
  }
  return segStates[segmentIndex(cls.starts, ts, yearStart, stepMs)];
}
function resolveHistory(eras, ts, stepMs) {
  const year = yearFromMs(ts);
  let e = eras[0];
  for (const era of eras) {
    if (era.fromYear <= year)
      e = era;
    else
      break;
  }
  if (e.kind === 3)
    return null;
  if (e.kind === 0)
    return e.offs[0];
  if (e.kind === 1) {
    const [r1, r2] = e.rules;
    return e.offs[ruleCycleIndex(e.offs[0], e.offs[1], r1, r2, year, ts)];
  }
  return e.offs[segmentIndex(e.steps, ts, Date.UTC(e.fromYear, 0, 1), stepMs)];
}
function historyAbbr(cls, offMin) {
  if (cls.kind === 0) {
    if (cls.states[0].offMin === offMin)
      return cls.states[0].abbr;
  } else if (cls.kind === 1) {
    for (const st of cls.states)
      if (st.offMin === offMin)
        return st.abbr;
  } else {
    for (let i = 0;i < cls.offMins.length; i++)
      if (cls.offMins[i] === offMin)
        return cls.abbrs[i];
  }
  return gmtLabel(offMin);
}
function resolveAbbrFix(c, ts, year, offMin) {
  const sf = c.spanFrom;
  for (let i = 0;i < sf.length; i++) {
    if (ts >= sf[i] && ts < c.spanTo[i])
      return c.spanAbbrs[i];
  }
  const fy = c.fromYear;
  for (let i = 0;i < fy.length; i++) {
    if (year >= fy[i] && year <= c.toYear[i] && c.offs[i] === offMin)
      return c.abbrs[i];
  }
  return null;
}

// shared/etcZones.ts
function buildFixedZones() {
  const out = new Map([
    ["UTC", makeInfo("UTC", "UTC", 0)],
    ["Etc/UTC", makeInfo("Etc/UTC", "UTC", 0)]
  ]);
  const add = (name, offset) => out.set(name, makeInfo(name, gmtLabel(offset), offset));
  for (let h = 1;h <= 14; h++) {
    if (h <= 12)
      add(`Etc/GMT+${h}`, -h * 60);
    add(`Etc/GMT-${h}`, h * 60);
  }
  return out;
}
var fixedZones = null;
function etcZoneInfo(name) {
  if (name !== "UTC" && !name.startsWith("Etc/"))
    return null;
  return (fixedZones ??= buildFixedZones()).get(name) ?? null;
}

// shared/bakedSchedule.ts
var classIdx = buildScheduleIndex(zones, scheduleClasses);
var nameIdx = new Map;
for (let z = 0;z < zones.length; z++)
  nameIdx.set(zones[z], z);
function zoneIndexOf(name) {
  const z = nameIdx.get(name);
  if (z != null)
    return z;
  const bridged = zoneLinks.get(name);
  return bridged != null ? nameIdx.get(bridged) ?? -1 : -1;
}
var stateA = new Array(zones.length);
var infoA = new Array(zones.length);
var stateB = new Array(zones.length);
var infoB = new Array(zones.length);
function zoneStateInfo(z, st) {
  if (stateA[z] === st)
    return infoA[z];
  if (stateB[z] === st)
    return infoB[z];
  const info = makeInfo(zones[z], st.abbr, st.offMin);
  stateB[z] = stateA[z];
  infoB[z] = infoA[z];
  stateA[z] = st;
  infoA[z] = info;
  return info;
}
function scheduleZoneInfo(name, ci, timestamp, schedCache, z = -1) {
  if (ci < 0)
    return etcZoneInfo(name) ?? makeInfo(name, "UTC", 0);
  let st = schedCache != null ? schedCache[ci] : undefined;
  if (st == null) {
    st = resolveClass(scheduleClasses[ci], timestamp, YEAR_START, STEP_MS);
    if (schedCache != null)
      schedCache[ci] = st;
  }
  return z >= 0 && zones[z] === name ? zoneStateInfo(z, st) : makeInfo(name, st.abbr, st.offMin);
}
function scheduleGetTimeZoneAt(name, timestamp) {
  const z = zoneIndexOf(name);
  return z === -1 ? etcZoneInfo(name) ?? undefined : scheduleZoneInfo(name, classIdx[z], timestamp, undefined, z);
}
function computeSchedule(timestamp) {
  const schedCache = new Array(scheduleClasses.length);
  const out = new Array(zones.length);
  for (let z = 0;z < zones.length; z++) {
    out[z] = scheduleZoneInfo(zones[z], classIdx[z], timestamp, schedCache, z);
  }
  return out;
}

// shared/tables/chrome/history.ts
var HISTORY_FROM = 1995;
var HISTORY_TO = 2026;
var Z = /* @__PURE__ */ scheduleClasses.flatMap((c) => c.zones);
var P2 = "8,12|0,4|4,0|4,8|8,4|-40,-36|-36,-32|-8,-12|-12,-16|-28,-24|-24,-20|-12,-8|-32,-28|-20,-16|-16,-12|-16,-20|-4,0|-14,-10|44,32|44,40|52,48|24,28|48,52|16,20|20,24|12,16|36,40|28,32|32,36|40,44|44,48|14,18|42,38|39,35|44,42|36,32|56,52|55,51|-20,-24";
var T = "455000955000a15000945000915000855000835000b1500061000091100061100051000082000041000075000051005062003c43005055003c42005053003c35005052003c33005044003c32005042003c25005041003c35003c95005095503ca5005091003ca5003c220000a10000230000a11000310000a20000250000b10000551000320000330000a3000055000063000031500091000042000034000051003c95003cb1200032003cb5300035000095000052000083000045000092000053000035610o94612cb1003ca4612c34610oa5612c410001a50001320001b10001a2001oa1001oa5001ob2001ob1001o45003c540000a2003ca1003c41001oa50000c1001o95001o81100032006oa1006oa15050a1000185003c41500093501o71400095501o354000355000a4501oa3501oa5501o416050411050a1206o412050a1306o413050a1406o414050a1506o410050a1106o415050a1606o35008ca500a035006oa5008c350046a50046416000411000a12000351000a13000a14000414000412000a16000b16000a55000a5006o45603c95603c35603c95600033500093100041503c91503c42503ca1501o42101o95101o35501oa1101o41301o94301o35503c93003c92003c94003c43300092200034300033400093600034600094100094200034100094300033200093400034400094600034500094000093200034200094400093000033300093500033100093300033600035001o43000043003c31005031003c95006oa4003c351050b2006o41006o330069a1004l95004l32610oa2610o95610o41610o51610o83610o45610o91610o52610o82610o92610o140050a3003c13005013003c120050b2003cc3003c15003c";
var E = "r000001|r000002|r000003|r000004|r000005|r000006|w0008,8t412,gfo8,ins12,k7o8|s8|w0008,9zs12,d3o8,fp412,juc8|d|r000007|s0|r010809|r010a06|r010b0c|r010d0e|w0000,8tk4,ew80,h6w4,k880|w0000,8o84,duw0,gdk4,m5k0|w0000,6iw4,d6w0,fs84,m2w0|w0000,6g84,c5k0,eqw4,m080|w0000,6dk4,bk80,e5k4,mg80|w0000,6884,adk0,dhk4,maw0|w0000,65k4,9s80,cdk4|r020f0g|r020h0i|r020j0k|r020l0m|r020n0o|r020p0q|r020r0s|r030t0u|w0008,12g12|s12|w00012,2ac8|w00012,mic8|w0000,0044|w0004,0040|w0008,k7s4|w0004,6vw8|w0008,n9c4|w0004,6g08|r030b0v|r030t0w|r040s0x|r050s0y|r060s0y|w000-12,l9o-8|r070z10|r071112|r071314|r071110|r071514|r071114|r071116|w000-8,3ew-12|w000-12,lsc-8|w000-8,3hk-12|w000-12,b9o-16,cog-12|w000-12,qwc-8|w000-8,5k8-12|r08170e|w000-8,1hk-12,51o-16,l4g-12|r081814|w000-12,b9o-16,c5s-12|r07191a|w000-8,5ew-12|r081b1c|r081510|r081d10|r081310|r080d1e|r080d1a|r08181a|r081f10|r081g10|r07111a|w000-12,lcc-8|w000-8,45k-12|s-28|r090s0y|r091h1i|w000-28,6x0-20,mgs-24|r0a0s0y|w000-16,kds-12|w000-12,48c-16,kts-12,lcc-16|w000-28,6x0-24|r0a0s16|w000-24,m8w-28|r08111a|r080z10|r081112|r081314|r081110|r081514|r081114|r081116|r08111j|r08151a|w000-12,3ho-16|s-24|w000-24,728-20|w000-20,6zg-16,fso-20,m0s-24|r0a1h1i|w000-24,2bk-20|w000-16,pcs-18|s-18|w000-18,8zg-16|w000-24,m0w-28|w000-28,6uc-24|r091k1l|r081m14|r08191n|r080d14|r081914|r081o1p|r081q1e|r081q1r|r081s0c|r081o0c|r080d1r|w000-12,3f0-16|w000-16,mog-12|r0b1t1u|w000-12,00c0|r0c0s0y|r0c1k1v|w000-32,4zs-28|r0d0s0y|r091k1v|w000-20,cz8-16|s-16|w000-16,n74-20|w000-32,4x4-28|w000-12,kdo-8|w000-8,488-12,kto-8,luw-12|w000-12,l70-8|r0e0s0y|r0b1t1w|r0b1x1y|r0b1t1y|w000-12,684-8|r0e1z20|r0e2122|r0e211v|w000-20,4ws-16|w000-16,mrc-20|r0a1q10|r0d0d23|r0d0d24|r0d1m25|r0d0d25|w000-20,6gk-16|w000-16,mb8-20|r0d1825|r0d1925|r0d1926|r0d0d27|s-20|w000-20,mbg-24|w000-24,54w-20|w000-24,54w-16,mrc-20|w000-20,6ws-16,mgo-24|w000-24,6u8-20|w000-8,31k-12|w000-20,00k-24|r0a1f10|r0a2824|r08291n|s-32|w000-32,mjs-36|w000-36,558-32|w000-32,1fs-36,52k-32,mp4-36|r0b0s0y|w000-12,jf0-8|r070t2a|r071k2b|w000-8,4wg-12|w000-8,kdk-4|w000-4,484-8,ktk-4,lc4-8|w000-8,l6w-4|w000-4,3hg-8|w000-28,5d0-24|w000-28,72c-24|w000-28,5ac-24|r0d2c0y|r0d0d2d|w000-20,m8s-24|w000-8,488-12,kto-8,lc8-12|w000-24,6rk-20|w000-20,mrg-24|w000-16,cz4-12|s-12|r0f0y2e|r07111j|r07151a|r0g1m2f|r0g1m25|w000-4,m84-8|r0h1z20|r0h2122|r0h211v|r0a0b2g|r0a0s0w|r0a1k1v|w00032,lgo44|w00044,4n032|w00032,m7c44|w00044,3tw32|w00032,lts44|s44|r0i2h2i|r0i0n2j|r0i0p2k|r0i182k|w00044,4xs32|w00028,lgs20|w00020,53k28|w00028,m7g20|w00020,3u828|r0j0l2b|r0j0l2l|s24|w00024,lgw20|r0k0n2b|r0k0n1i|s28|w00028,pzg20|r0l0t0u|r0l0t0w|w00024,4fc20|r002m2n|r002o2p|r002q2p|r002r2p|r002r2s|r002r2t|r002m2p|r002r2u|r002m2u|w0008,6l412|w00012,q508|w0008,42g12|r0m0t0u|r0m0t0w|w00048,mf044|w00044,69o48|r0n0t0u|r0n0t0w|w00016,6fs20|r0o0t0u|r0o0t0w|w00020,mfs16|r0p2v2i|r0p2w2x|r0p2y2z|r0p3031|r0p3233|r0p3435|r0p3637|r0n3839|r0n3a3b|w00028,67g32,av428,jow24|w00024,6a828|w00028,m2424|w00024,6cw28|r001m1n|r0o1f1n|r0o0d1n|r0o3c3d|w00020,6ae24|r0q0t0u|r0q0t0w|w00036,69w40|s40|w00040,m1s32|s32|w00032,6co36|w00022,aq226,m4o24|w00024,7oq22|r003e10|r003f3g|r003h3i|r003h3j|r003k02|r000d12|r003l3i|r002m3m|r003e03|r002r07|r002m3n|r002r3o|r002m3o|w0008,65412|w00024,ckk28,r0k24|w00032,j8g36|r001m3p|w0008,6dg12|w00012,mas8|r0r1m1n|r0r3q3r|r0r3s3r|r0r3s3t|r0s0t0u|r0s0t0w|w00032,6a036|s36|w00036,m1w32|r002r1e|r003u3v|r003u1r|r003u1e|r003w3x|r003y3z|r004041|r004243|r00423z|r004445|r003w2a|r00462b|r004647|r00461i|r004648|r003w2b|r004649|r00460y|r0o0d10|r0o083n|r0o4a16|w00036,6hw40,m1w36,r0c40|r0t0t0w|r0t0t4b|w00040,m1s36|r0r0t0u|r0r0t0w|w00028,6a432|w00032,m2028|r0u0t0u|r0u0t0w|s48|w00048,m1k40|w00040,8f444|w00028,mfk24|w00024,f6828|w00036,gpo34|s34|w00034,95o36|w00020,6fo24|w00024,q7c20|w00044,m1s40|w00040,69s44|w00044,m1o40|w00040,6cg44|w00048,m1k44|r0n1m1n|w00016,6nk20|w00020,m2416|r0n1m2d|w00016,6fk20,d6416,mik12|w00012,6ak16|r0v4c03|r0v4d4e|r0v4f4g|r0v1g4h|r0v4i4j|r0v4k4l|r0v4m4n|r0v4o4p|r0v194q|r0v4r4s|r0v3u4t|r0v4u4v|r0v4w4x|r0v4y3v|w00028,6ks32,8vg28,m4w24|w00024,b0w28|r0s1m1n|r0s3q3r|r0s3s3r|r0s3s3t|r0u0t4b|r0t0t0u|w00020,6ac24|w00024,m2820|w00012,67w16|r014z1i|r08501r|r08504t|r08510x|r0w0l0y|r0w340y|r0w520y|w00035,ov939|r0x0l0y|w00039,6f935|r0y530y|r0y0t0y|r0y0t2l|r0y0s0y|r0j0l0y|r0j340y|w00032,ovc36|r0z0l0y|w00036,6fc32|r0j520y|r0p0t0u|r0p0t0w|w00016,m2g12|w00012,6d816|r000l54|r001m2d|r000t0w|r014z55|r004z1i|r004z0y|r000l3p|r00563p|r000l57|r000t0u|w0008,6ao12|w00012,m2k8|r000t3p|s16|w0004,m840|w00016,mfw12|w00012,p1816|r0p1m3p|w00012,m2s8|w0008,6io16,m2g12|w0008,m044|w0004,6dg8|w00012,m7w16|w00016,qqg12|w00020,r0s24|w00016,m5420|w00020,6fo16|s-44|w000-44,jvw-40|w000-40,6s8-44,jqw-40,qx456|r10580u|w00056,6uw52|w00040,qps44|r11595a|r11595b|r125c5d|r121t5d|r125c5e|r125f5d|r125g5h|r125i5j|r125k5l|r125f5m|w000-44,qx852|w00048,mhk52|r0k0r1v|w00052,46w48|w00048,ok852|r0k0l55|r0k5255|r0k5n5o|r0k5p0y|r0k5q1v|r0k5p1v|r0k5r1v|r0k5r5s|r0k5r5t|w00052,15k48|w00048,r0044|s46|w00046,key44|w00044,kkc48|w00044,osc48|w00048,4f044|s-34|w000-34,8ma-32|w00052,kms56|r100n1v|r105u1v|w00056,1w052|w00052,mxg56|w00056,10452";
var H = "80~000401500901a00b02c03d04e05f06g07j08k07s09t0au09|bebf~00bd0ce0df0eg0fh0gi0hj0ik0jl0km0ln0mo0np0oq0pr0qs0rt0su0t|8182838485868788898a8b8c8d8e8f8g8h8i8j8k8l8m8n8o8p8q8r8s8t8u8v8w8x~00u109|17~00950v60wq0xr09|18~00950v60wm0yn09|0c~009n0zo10p09|1h~009111212309h13i14j09|0r~009a15b16e09|1d~017n09|8y~018c09|8z90929394~019c09|26~01a11b21c31d41e51f61g71h81i909h1ji1kj09|2e2f2m~00991la09c1md1ne09|2g2o~009c1md1ne09|2h~00991oa09c1md1ne09|2i~00991oa09c1md1pe1qf09|2j~00991ra09c1md1se1tf09|2k~00991ua09c1md1ne09|2q~01v11w21v31x71y91za20f21i22u09|27~02311b21c31d41e51f61g71h81i909g24h25i09|2r~026127628727f29g2as09|34~00942b52c609|9598~027c09|2l2n~009c1md1se1tf09|96~02742d52e62f727c09|35~02g12h22i32j42k52l62m72n82g92oa2gb2nc2ld2gh2pi2gk2pl2gn2no2qp09|3a~02r12a22s32t42a62u72ak2vl09|3f~009c2wd2xl2ym09|999d9f~02ac09|2t~00912a32z427628727r30s09|97~02r12a32z427628727f09r31s09|3h~02011q23233343452061qb20c1qd32e35f34g36h37i38j37k09l39m3ao3bp1yr3bs1yt3bu09|36~02g12h22i32j42k52l62m72n83c93da2gb2nc2ld2gh2pi2gk2pl2gn2no2qp09|0d~03e13f209|3l3r~03gc3hp3iq09|9k9u9v9w9y~03jc09|bgbh~027c3k|3s3t~009d3le3mi3nj09|3n~03gc3hk3ol09|29~00943p53q63r71k809|9za1a3a4~03sc09|a5~03e13t43u73vc3ud3tf3ui3tl3uo3tq3vs3wt09|a0~03xc3yg3zh09|9l~03jc09k40l3mn41o09|2w~009b42c09|a7~043144243345546947a3mb48c49d4ae49g4bh4ci09|3o~009127409|9a9b~04db4ec09|9m9o9r~04db3jc09|9n9p~04db4ec4fd09|9q~04db4ec4gd09|9s~03j44h54i63jc09|9t~02a54i63jc09|a8~03gc09|2a~01a14j20943p53q63r71k809|2x~04d24k309a4lb4mc09|9c~02r12a62u72af09|3p~009127628727s09|2p~00994na09c1md1ne09|2y2z30~00912a62u72as09|91~04ok4pl09n4qo4rp09|aa~04sc09|a2~03xc09|3y~00994ta4ub4vk4wl09|3z~00944x54y64z750809|9e~027c3kf51g09|9g~02785292ac09|9h~02r12a32z427628727f3kr53s09|9x~05434da55c4dh09l4dm09|3i3j~02011q23233343452061qb20c1qd32e35f34g36h37i38j37k09l39m09|9i~02a54i65672ac09|2b~00943p55763r71k809|9j~02a54i65672ab58c59d09|2c~03md5ae09|ab~02011q23233343452061qb20c1qd32e35f34g36h37i38j37k5bl39m3ao3bp09r3bs09t3bu09|1z~00955c609|2d~02311b21c31d41e51f61g71h82395da23b1hc1fd23h5ei23k5el23n1ho1kp09|a6~05f15gt5hu09|ac~05ic5jg5kh09|33~009b5lc09|a9~03gf09|bi~03gc3h|bj~05mb2ac5n|41~009e5of5pg5qh5ri09l5sm5tn5uo5vp5wq5xs5yt09|43~009e5zf60g61h62i09|ad~063564663b09c63d09f5tg09|45~065e66f09|ahai~067c68d09|aj~00ba09|48~069s6at09|4f~06b16ca65t6du09|4m~06e46f56g76h86i96ja6kb6lg6mh6ni6oj6ll6mm6lr6ps09|4o4p~06q16rf6sg6th09|4g4j~06u16v96wa09|4h~06x16ya09|4i~06x16y46z56v96wa09|4a~070171272373474570675771872974a76b70c75d09|4r~009177278l09|4w~07916cg7ah09j7bk65l7cm09|ak~07d409|51~07e17f27ga7hb09|55~07i17jg7kh7lj7mk7nl7om09|54~00917p265b7qc09|4n~07r17s27t37u47v57r67w77s87x97va7yb7zc80d81e82f83h82r84s09|58~009e85f09|59~07n586609|al~07d387409l88m89n09|5e~08a40968b78cc09k8dm09|5f~08e18fg8gh8hj8ik09|ax~08j18k28l38m48n58o68p78q88r98sa8tb8uc8vd8ue8wf8xg8yh8zi90j09o90p09t90u09|5k~009791809d92e93f09|56~07i17j894995g96h7lj97k09|4x~098199g9ah7nj9bk09|5q~09c19dg6th9ej9fk7ll9gm09|am~07d387409|4y~098199f9hg7ah09|4z~06b16cg7ah09j7bk65l9im09|5v~06b16cg7ah69j7bk09|5w~009k9jl9kn9lo09|4k~06x16y99ma65t6du09|4l~06x16y99ma65n9no09|5r~09c19d29o395g9ph09j9qk7ll9rm09|5s~09c19dg6th9ej9sk09|63~09t19u29v39w99xa9yb09|64~09z1a02a13a24a35a46a57a68a19a7aa8b09da9ea2fa3ga8haaia6ja1ka2labm9zna5oa6pacqa3ra8s09|50~0981997ad86cg7ah09j7bk65laem09|67~0af4096ag7ahc09kaim09|69~09c19dgajh5tj9qk09|6a~0ak195g9ph5tj9qk09|57~07i17jg7kh7lj97k09|6b~06x16ygalh65jamk09|6c~0an10926vh09|ay~05f109|azb0b1~0ao109|6f~0ap1aq2ap6arg09|b3~0asbatcasd09|b4~0au1asbatcasd09|6j~009bavcaweaxf09|ae~063564663b09c63d09|b5~0ay1az5b06azbb1cazd09|af~0b25646b2bb3cb2d09|42~009bb4cb5eb6f09|ag~0b71b25646b2bb3cb2d09|6k6n~0b81b9g9yh09jbak0wlbbm09|anaqas~0bc109|aoau~07d1bd209|ap~07d1bd2ber09|b6b7b8b9ba~0bf109|6o~0bg1bhcbigbjhbijbjkbkl88m09|1i~0bl1begbmh0wjbnk09|ar~0bl1bo209|6p6r~0b81b9g9yhbpjbak09|b2~00u1bq209|6q~0bl1begbmh09|at~0bl209507609|6l~06u16vfbrg9yh09|6m~0b81b9g9yh09jbak0wlbsm09|6s~0b81bt2bu3bijbvk09|av~0bl1be3bo409507709|aw~0bl1be3bw4bx507809|6t~0b81b9g9yhbpjbak09nbyobppbzq09|6u~0c0109|70~009dc1ec2f09|72~0c3fc4gc5hc6qc7r09|73~07ljc8k09|bb~0c9ccad09|bc~0cb2cc3cd4ce5cbdccecbfcegcfhcgk4dlcho09rcis09|76~0c3gcjh09|77~0093ck4cl5cm609ecnfcogcphcqicrjcskctncuocvpcwqcxr09|7g~09e3cy409|bd~0czkd0l5tod1p09|7o~0091d22d3309|7q~0d43d5409|7w~0094d65d76d87d9809ldamdbn09";
var historyClasses = /* @__PURE__ */ decodeHistory(Z, P2, T, E, H, HISTORY_FROM);

// shared/tables/chrome/abbrfix.ts
var ABBRFIX_FROM = 1995;
var Z2 = /* @__PURE__ */ scheduleClasses.flatMap((c) => c.zones);
var A = "CEST,GMT+2,AST,WAST,PYST,MDT,CST,CDT,MPDT,CLST,PDT,WGST,EST,PST,EGST,ANAT,MST,WKT,GMT+5,GMT+7,GMT+6,EET,NOVT,NST,KST,SAKT,SST,GMT+11,GST,FIST,MSK,CET,EEST,FET,NMIT";
var F = "1h~~1p18,djw,0;bmw8,fk0,0|1d~0,l,1k,1~gag4,fjw,1;bes,3ro,1|2e2f2g2h2j2k2l2m2n2o2p~~3klo,b9c,2|2i~d,0,10,3~3klo,b9c,3;6gys,avw,3|2q~0,s,10,4~llsg,cyk,4;eis,nw,4|2r~1,d,o,5~|96~5,0,o,6~3mow,beo,6;g2c,awg,6|3a~1,0,s,7;4,f,s,7~1p7k,f18,7;kqk,684,7|2t~4,m,o,8~2g6c,f18,8;hm5g,fjw,8|97~0,2,o,6;4,m,o,8~248s,bxk,6;0,f18,8;hklg,h3w,8;0,2ag,6|3h~k,0,10,9~mjpc,5sc,9|3l3r~0,o,k,a~ixd4,hmc,a|3n~0,j,k,a~|a5~0,s,14,b~lslc,6as,b|9l~k,2,w,2~f60s,29eo,2|9a9b~0,a,s,c~0,8ge4,c|9n9p~~8ge4,fk0,7;9us,hmk,7|9q~~8ge4,fk0,7|9s~~3y3k,fjw,7|9t~0,4,s,7~3y3k,fjw,7|91~0,k,g,d~hx2g,5pc,d|9e~0,e,o,5~bf7o,hmk,5|9g~0,7,o,5~67ic,f18,5|9h~4,m,o,5~2g6c,f18,5;hklg,h3w,5|3i3j~k,0,10,9~|9i~~4dng,bes,c|9j~~4dng,bes,c;46vw,9us,c|a6~0,s,18,e~lnus,beo,e|4o~0,e,2o,f~b4s8,beo,f;0,g2s,g|4g~0,8,1w,2;a,i,1w,h~6xx4,g2o,2;0,4lk,h;0,eefc,h|4h~0,8,1w,2;a,i,1w,h~6mic,beo,2;g2o,4lo,h;0,eefc,h|4i~0,8,1w,i;a,i,1w,h~6xx4,g2o,i;0,4lk,h;0,eefc,h|4w~0,j,24,j~|51~0,9,20,k~7ovq,a7m,k|al~~gelg,aw0,l|5o~0,3,28,g~0,3qcg,g|4y~g,2,24,m~bg7g,g2s,n;vn4,247g,m|4z~0,f,24,n;g,3,24,m~|4j~0,8,1w,i;a,i,1w,h~6xx4,g2o,i;0,4lk,h;0,eefc,h|4k~0,9,1w,i~|4l~0,9,1w,o;n,5,1w,h~i1c0,3voo,h|5r~0,1,2k,p;3,c,2k,q;g,3,2k,p~1d8c,beo,p;0,fk4,q;duao,2ao,r|5s~j,1,2k,r~f140,zgg,r|63~~74ng,9cg,s|50~0,j,24,j~|6c~~67w,dhc,2|6f~0,e,10,t~b17c,gl8,t|6k6m6n~0,f,1s,g;g,3,1s,u~|b2~0,0,1g,v~jpg,e00,v|6q~0,f,1o,w;g,2,1o,x~crxc,24ag,x|6l~~bg7s,g2s,q|6s~3,f,1o,w~1oo4,fk0,w|aw~~2fms,fk0,0;beo,g2o,0|7c~0,4,2g,s~0,4ho8,s|7d~0,4,2g,y~0,4ho8,y";
var abbrFixClasses = /* @__PURE__ */ decodeAbbrFix(Z2, A, F, ABBRFIX_FROM, STEP_MS);

// shared/bakedHistory.ts
var histIdx = /* @__PURE__ */ buildScheduleIndex(zones, historyClasses);
var fixIdx = /* @__PURE__ */ buildScheduleIndex(zones, abbrFixClasses);
var HISTORY_TO_MS = Date.UTC(HISTORY_TO, 0, 1);
function fixedAbbr(z, timestamp, offMin) {
  if (z === -1)
    return null;
  const fi = fixIdx[z];
  return fi === -1 ? null : resolveAbbrFix(abbrFixClasses[fi], timestamp, yearFromMs(timestamp), offMin);
}
function historyLabel(z, ci, timestamp, offMin) {
  return fixedAbbr(z, timestamp, offMin) ?? (ci < 0 ? gmtLabel(offMin) : historyAbbr(scheduleClasses[ci], offMin));
}
function bakedZoneInfo(name, ci, hi, timestamp, historical, schedCache, histCache, z = -1) {
  if (historical && hi !== -1) {
    let off = histCache != null ? histCache[hi] : undefined;
    if (off === undefined) {
      off = resolveHistory(historyClasses[hi].eras, timestamp, STEP_MS);
      if (histCache != null)
        histCache[hi] = off;
    }
    if (off !== null) {
      return makeInfo(name, historyLabel(z, ci, timestamp, off), off);
    }
  }
  const info = scheduleZoneInfo(name, ci, timestamp, schedCache, z);
  if (historical) {
    const fix = fixedAbbr(z, timestamp, info.offset);
    if (fix !== null && fix !== info.abbr)
      return makeInfo(name, fix, info.offset);
  }
  return info;
}
function getTimeZoneAt(name, timestamp) {
  const z = zoneIndexOf(name);
  if (z === -1)
    return etcZoneInfo(name) ?? undefined;
  return bakedZoneInfo(name, classIdx[z], histIdx[z], timestamp, timestamp < HISTORY_TO_MS, undefined, undefined, z);
}
function computeBaked(timestamp) {
  const historical = timestamp < HISTORY_TO_MS;
  const schedCache = new Array(scheduleClasses.length);
  const histCache = historical ? new Array(historyClasses.length) : undefined;
  const out = new Array(zones.length);
  for (let z = 0;z < zones.length; z++) {
    out[z] = bakedZoneInfo(zones[z], classIdx[z], histIdx[z], timestamp, historical, schedCache, histCache, z);
  }
  return out;
}

// shared/hourCache.ts
var HOUR_MS = 3600000;
function hourBucketMemo(compute) {
  let lastBucket = NaN;
  let lastResult = [];
  return {
    get(timestamp) {
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
    }
  };
}

// shared/listApi.ts
var lazyList = () => ({ memo: null, canon: null });
function listAt(state, compute, timestamp, withAliases) {
  const full = (state.memo ??= hourBucketMemo(compute)).get(timestamp);
  return withAliases ? full : (state.canon ??= canonicalView())(full);
}
function clearList(state) {
  state.memo?.clear();
  state.canon = null;
}

// shared/tables/chrome/offsets.ts
var offsetStrings = new Map([
  [-660, "-11:00"],
  [-600, "-10:00"],
  [-570, "-09:30"],
  [-540, "-09:00"],
  [-510, "-08:30"],
  [-480, "-08:00"],
  [-420, "-07:00"],
  [-360, "-06:00"],
  [-300, "-05:00"],
  [-270, "-04:30"],
  [-240, "-04:00"],
  [-210, "-03:30"],
  [-180, "-03:00"],
  [-150, "-02:30"],
  [-120, "-02:00"],
  [-60, "-01:00"],
  [0, "+00:00"],
  [60, "+01:00"],
  [120, "+02:00"],
  [180, "+03:00"],
  [210, "+03:30"],
  [240, "+04:00"],
  [270, "+04:30"],
  [300, "+05:00"],
  [330, "+05:30"],
  [345, "+05:45"],
  [360, "+06:00"],
  [390, "+06:30"],
  [420, "+07:00"],
  [480, "+08:00"],
  [510, "+08:30"],
  [525, "+08:45"],
  [540, "+09:00"],
  [570, "+09:30"],
  [585, "+09:45"],
  [600, "+10:00"],
  [630, "+10:30"],
  [660, "+11:00"],
  [690, "+11:30"],
  [720, "+12:00"],
  [765, "+12:45"],
  [780, "+13:00"],
  [825, "+13:45"],
  [840, "+14:00"]
]);

// shared/offsetFormatBaked.ts
function formatOffset(minutes) {
  return offsetStrings.get(minutes) ?? "";
}

// impls/07-baked-rules/index.ts
var hist = lazyList();
var sched = lazyList();
function getTimeZonesAt(timestamp, withAliases = true) {
  return listAt(hist, computeBaked, timestamp, withAliases);
}
function getTimeZones(withAliases = true) {
  return listAt(sched, computeSchedule, Date.now(), withAliases);
}
function getTimeZoneAt2(name, timestamp, withAliases = true) {
  return getTimeZoneAt(withAliases ? name : canonicalZone(name), timestamp);
}
function getTimeZone(name, withAliases = true) {
  return scheduleGetTimeZoneAt(withAliases ? name : canonicalZone(name), Date.now());
}
function clearCache() {
  clearList(hist);
  clearList(sched);
}
export {
  clearCache,
  formatOffset,
  getTimeZone,
  getTimeZoneAt2 as getTimeZoneAt,
  getTimeZones,
  getTimeZonesAt
};
