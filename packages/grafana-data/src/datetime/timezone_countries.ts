// Country -> IANA time zone mapping, vendored from the moment-timezone 0.6.3 package
// (data/meta/latest.json, IANA tz database 2026c, derived from zone1970.tab). Zone names are
// packed with the same prefix-index scheme used by easytz.ts. To regenerate, download the
// moment-timezone tarball from the npm registry and rebuild this table from the countries
// section of data/meta/latest.json.

const PREFIXES =
  'America/|Asia/|Europe/|Africa/|Pacific/|Indian/|Antarctica/|Australia/|Atlantic/|Arctic/|America/Argentina/|America/Indiana/|America/North_Dakota/|America/Kentucky/'.split(
    '|'
  );

const PACKED =
  'AD:2Andorra|AE:1Dubai|AF:1Kabul|AG:0Puerto_Rico,0Antigua|AI:0Puerto_Rico,0Anguilla|AL:2Tirane|AM:1Yerevan|' +
  'AO:3Lagos,3Luanda|' +
  'AQ:6Casey,6Davis,6Mawson,6Palmer,6Rothera,6Troll,6Vostok,4Auckland,4Port_Moresby,1Riyadh,1Singapore,6McMurdo,6DumontDUrville,6Syowa|' +
  'AR:aBuenos_Aires,aCordoba,aSalta,aJujuy,aTucuman,aCatamarca,aLa_Rioja,aSan_Juan,aMendoza,aSan_Luis,aRio_Gallegos,aUshuaia|' +
  'AS:4Pago_Pago|AT:2Vienna|' +
  'AU:7Lord_Howe,6Macquarie,7Hobart,7Melbourne,7Sydney,7Broken_Hill,7Brisbane,7Lindeman,7Adelaide,7Darwin,7Perth,7Eucla,1Tokyo|' +
  'AW:0Puerto_Rico,0Aruba|AX:2Helsinki,2Mariehamn|AZ:1Baku|BA:2Belgrade,2Sarajevo|BB:0Barbados|BD:1Dhaka|' +
  'BE:2Brussels|BF:3Abidjan,3Ouagadougou|BG:2Sofia|BH:1Qatar,1Bahrain|BI:3Maputo,3Bujumbura|BJ:3Lagos,3Porto-Novo|' +
  'BL:0Puerto_Rico,0St_Barthelemy|BM:8Bermuda|BN:1Kuching,1Brunei|BO:0La_Paz|BQ:0Puerto_Rico,0Kralendijk|' +
  'BR:0Noronha,0Belem,0Fortaleza,0Recife,0Araguaina,0Maceio,0Bahia,0Sao_Paulo,0Campo_Grande,0Cuiaba,0Santarem,0Porto_Velho,0Boa_Vista,0Manaus,0Eirunepe,0Rio_Branco|' +
  'BS:0Toronto,0Nassau|BT:1Thimphu|BW:3Maputo,3Gaborone|BY:2Minsk|BZ:0Belize|' +
  'CA:0St_Johns,0Halifax,0Glace_Bay,0Moncton,0Goose_Bay,0Toronto,0Iqaluit,0Winnipeg,0Resolute,0Rankin_Inlet,0Regina,0Swift_Current,0Edmonton,0Cambridge_Bay,0Inuvik,0Vancouver,0Dawson_Creek,0Fort_Nelson,0Whitehorse,0Dawson,0Panama,0Puerto_Rico,0Phoenix,0Blanc-Sablon,0Atikokan,0Creston|' +
  'CC:1Yangon,5Cocos|CD:3Maputo,3Lagos,3Kinshasa,3Lubumbashi|CF:3Lagos,3Bangui|CG:3Lagos,3Brazzaville|CH:2Zurich|' +
  'CI:3Abidjan|CK:4Rarotonga|CL:0Santiago,0Coyhaique,0Punta_Arenas,4Easter|CM:3Lagos,3Douala|CN:1Shanghai,1Urumqi|' +
  'CO:0Bogota|CR:0Costa_Rica|CU:0Havana|CV:8Cape_Verde|CW:0Puerto_Rico,0Curacao|CX:1Bangkok,5Christmas|' +
  'CY:1Nicosia,1Famagusta|CZ:2Prague|DE:2Zurich,2Berlin,2Busingen|DJ:3Nairobi,3Djibouti|DK:2Berlin,2Copenhagen|' +
  'DM:0Puerto_Rico,0Dominica|DO:0Santo_Domingo|DZ:3Algiers|EC:0Guayaquil,4Galapagos|EE:2Tallinn|EG:3Cairo|' +
  'EH:3El_Aaiun|ER:3Nairobi,3Asmara|ES:2Madrid,3Ceuta,8Canary|ET:3Nairobi,3Addis_Ababa|FI:2Helsinki|FJ:4Fiji|' +
  'FK:8Stanley|FM:4Kosrae,4Port_Moresby,4Guadalcanal,4Chuuk,4Pohnpei|FO:8Faroe|FR:2Paris|GA:3Lagos,3Libreville|' +
  'GB:2London|GD:0Puerto_Rico,0Grenada|GE:1Tbilisi|GF:0Cayenne|GG:2London,2Guernsey|GH:3Abidjan,3Accra|' +
  'GI:2Gibraltar|GL:0Nuuk,0Danmarkshavn,0Scoresbysund,0Thule|GM:3Abidjan,3Banjul|GN:3Abidjan,3Conakry|' +
  'GP:0Puerto_Rico,0Guadeloupe|GQ:3Lagos,3Malabo|GR:2Athens|GS:8South_Georgia|GT:0Guatemala|GU:4Guam|GW:3Bissau|' +
  'GY:0Guyana|HK:1Hong_Kong|HN:0Tegucigalpa|HR:2Belgrade,2Zagreb|HT:0Port-au-Prince|HU:2Budapest|' +
  'ID:1Jakarta,1Pontianak,1Makassar,1Jayapura|IE:2Dublin|IL:1Jerusalem|IM:2London,2Isle_of_Man|IN:1Kolkata|' +
  'IO:5Chagos|IQ:1Baghdad|IR:1Tehran|IS:3Abidjan,8Reykjavik|IT:2Rome|JE:2London,2Jersey|JM:0Jamaica|JO:1Amman|' +
  'JP:1Tokyo|KE:3Nairobi|KG:1Bishkek|KH:1Bangkok,1Phnom_Penh|KI:4Tarawa,4Kanton,4Kiritimati|KM:3Nairobi,5Comoro|' +
  'KN:0Puerto_Rico,0St_Kitts|KP:1Pyongyang|KR:1Seoul|KW:1Riyadh,1Kuwait|KY:0Panama,0Cayman|' +
  'KZ:1Almaty,1Qyzylorda,1Qostanay,1Aqtobe,1Aqtau,1Atyrau,1Oral|LA:1Bangkok,1Vientiane|LB:1Beirut|' +
  'LC:0Puerto_Rico,0St_Lucia|LI:2Zurich,2Vaduz|LK:1Colombo|LR:3Monrovia|LS:3Johannesburg,3Maseru|LT:2Vilnius|' +
  'LU:2Brussels,2Luxembourg|LV:2Riga|LY:3Tripoli|MA:3Casablanca|MC:2Paris,2Monaco|MD:2Chisinau|' +
  'ME:2Belgrade,2Podgorica|MF:0Puerto_Rico,0Marigot|MG:3Nairobi,5Antananarivo|MH:4Tarawa,4Kwajalein,4Majuro|' +
  'MK:2Belgrade,2Skopje|ML:3Abidjan,3Bamako|MM:1Yangon|MN:1Ulaanbaatar,1Hovd|MO:1Macau|MP:4Guam,4Saipan|' +
  'MQ:0Martinique|MR:3Abidjan,3Nouakchott|MS:0Puerto_Rico,0Montserrat|MT:2Malta|MU:5Mauritius|MV:5Maldives|' +
  'MW:3Maputo,3Blantyre|' +
  'MX:0Mexico_City,0Cancun,0Merida,0Monterrey,0Matamoros,0Chihuahua,0Ciudad_Juarez,0Ojinaga,0Mazatlan,0Bahia_Banderas,0Hermosillo,0Tijuana|' +
  'MY:1Kuching,1Singapore,1Kuala_Lumpur|MZ:3Maputo|NA:3Windhoek|NC:4Noumea|NE:3Lagos,3Niamey|NF:4Norfolk|' +
  'NG:3Lagos|NI:0Managua|NL:2Brussels,2Amsterdam|NO:2Berlin,2Oslo|NP:1Kathmandu|NR:4Nauru|NU:4Niue|' +
  'NZ:4Auckland,4Chatham|OM:1Dubai,1Muscat|PA:0Panama|PE:0Lima|PF:4Tahiti,4Marquesas,4Gambier|' +
  'PG:4Port_Moresby,4Bougainville|PH:1Manila|PK:1Karachi|PL:2Warsaw|PM:0Miquelon|PN:4Pitcairn|PR:0Puerto_Rico|' +
  'PS:1Gaza,1Hebron|PT:2Lisbon,8Madeira,8Azores|PW:4Palau|PY:0Asuncion|QA:1Qatar|RE:1Dubai,5Reunion|RO:2Bucharest|' +
  'RS:2Belgrade|' +
  'RU:2Kaliningrad,2Moscow,2Simferopol,2Kirov,2Volgograd,2Astrakhan,2Saratov,2Ulyanovsk,2Samara,1Yekaterinburg,1Omsk,1Novosibirsk,1Barnaul,1Tomsk,1Novokuznetsk,1Krasnoyarsk,1Irkutsk,1Chita,1Yakutsk,1Khandyga,1Vladivostok,1Ust-Nera,1Magadan,1Sakhalin,1Srednekolymsk,1Kamchatka,1Anadyr|' +
  'RW:3Maputo,3Kigali|SA:1Riyadh|SB:4Guadalcanal|SC:1Dubai,5Mahe|SD:3Khartoum|SE:2Berlin,2Stockholm|SG:1Singapore|' +
  'SH:3Abidjan,8St_Helena|SI:2Belgrade,2Ljubljana|SJ:2Berlin,9Longyearbyen|SK:2Prague,2Bratislava|' +
  'SL:3Abidjan,3Freetown|SM:2Rome,2San_Marino|SN:3Abidjan,3Dakar|SO:3Nairobi,3Mogadishu|SR:0Paramaribo|SS:3Juba|' +
  'ST:3Sao_Tome|SV:0El_Salvador|SX:0Puerto_Rico,0Lower_Princes|SY:1Damascus|SZ:3Johannesburg,3Mbabane|' +
  'TC:0Grand_Turk|TD:3Ndjamena|TF:1Dubai,5Maldives,5Kerguelen|TG:3Abidjan,3Lome|TH:1Bangkok|TJ:1Dushanbe|' +
  'TK:4Fakaofo|TL:1Dili|TM:1Ashgabat|TN:3Tunis|TO:4Tongatapu|TR:2Istanbul|TT:0Puerto_Rico,0Port_of_Spain|' +
  'TV:4Tarawa,4Funafuti|TW:1Taipei|TZ:3Nairobi,3Dar_es_Salaam|UA:2Simferopol,2Kyiv|UG:3Nairobi,3Kampala|' +
  'UM:4Pago_Pago,4Tarawa,4Midway,4Wake|' +
  'US:0New_York,0Detroit,dLouisville,dMonticello,bIndianapolis,bVincennes,bWinamac,bMarengo,bPetersburg,bVevay,0Chicago,bTell_City,bKnox,0Menominee,cCenter,cNew_Salem,cBeulah,0Denver,0Boise,0Phoenix,0Los_Angeles,0Anchorage,0Juneau,0Sitka,0Metlakatla,0Yakutat,0Nome,0Adak,4Honolulu|' +
  'UY:0Montevideo|UZ:1Samarkand,1Tashkent|VA:2Rome,2Vatican|VC:0Puerto_Rico,0St_Vincent|VE:0Caracas|' +
  'VG:0Puerto_Rico,0Tortola|VI:0Puerto_Rico,0St_Thomas|VN:1Bangkok,1Ho_Chi_Minh|VU:4Efate|WF:4Tarawa,4Wallis|' +
  'WS:4Apia|YE:1Riyadh,1Aden|YT:3Nairobi,5Mayotte|ZA:3Johannesburg|ZM:3Maputo,3Lusaka|ZW:3Maputo,3Harare';

function decodeZone(z: string): string {
  return PREFIXES[parseInt(z[0], 36)] + z.slice(1);
}

/**
 * IANA time zones by ISO 3166-1 alpha-2 country code, e.g. { US: ['America/New_York', ...] }.
 * Only canonical zone ids appear (legacy spellings have no country entry, as in moment-timezone).
 */
export const zonesByCountry: Record<string, string[]> = (() => {
  const result: Record<string, string[]> = {};

  for (const entry of PACKED.split('|')) {
    const [code, zones] = entry.split(':');
    result[code] = zones.split(',').map(decodeZone);
  }

  return result;
})();
