import { __assign } from "tslib";
import moment from 'moment-timezone';
import { memoize } from 'lodash';
import { getTimeZone } from './common';
export var InternalTimeZones;
(function (InternalTimeZones) {
    InternalTimeZones["default"] = "";
    InternalTimeZones["localBrowserTime"] = "browser";
    InternalTimeZones["utc"] = "utc";
})(InternalTimeZones || (InternalTimeZones = {}));
export var timeZoneFormatUserFriendly = function (timeZone) {
    switch (getTimeZone({ timeZone: timeZone })) {
        case 'browser':
            return 'Local browser time';
        case 'utc':
            return 'UTC';
        default:
            return timeZone;
    }
};
export var getTimeZoneInfo = function (zone, timestamp) {
    var internal = mapInternal(zone, timestamp);
    if (internal) {
        return internal;
    }
    return mapToInfo(zone, timestamp);
};
export var getTimeZones = memoize(function (includeInternal) {
    if (includeInternal === void 0) { includeInternal = false; }
    var initial = [];
    if (includeInternal) {
        initial.push.apply(initial, [InternalTimeZones.default, InternalTimeZones.localBrowserTime, InternalTimeZones.utc]);
    }
    return moment.tz.names().reduce(function (zones, zone) {
        var countriesForZone = countriesByTimeZone[zone];
        if (!Array.isArray(countriesForZone) || countriesForZone.length === 0) {
            return zones;
        }
        zones.push(zone);
        return zones;
    }, initial);
});
export var getTimeZoneGroups = memoize(function (includeInternal) {
    if (includeInternal === void 0) { includeInternal = false; }
    var timeZones = getTimeZones(includeInternal);
    var groups = timeZones.reduce(function (groups, zone) {
        var _a, _b;
        var delimiter = zone.indexOf('/');
        if (delimiter === -1) {
            var group_1 = '';
            groups[group_1] = (_a = groups[group_1]) !== null && _a !== void 0 ? _a : [];
            groups[group_1].push(zone);
            return groups;
        }
        var group = zone.substr(0, delimiter);
        groups[group] = (_b = groups[group]) !== null && _b !== void 0 ? _b : [];
        groups[group].push(zone);
        return groups;
    }, {});
    return Object.keys(groups).map(function (name) { return ({
        name: name,
        zones: groups[name],
    }); });
});
var mapInternal = function (zone, timestamp) {
    var _a, _b, _c, _d;
    switch (zone) {
        case InternalTimeZones.utc: {
            return {
                name: 'Coordinated Universal Time',
                ianaName: 'UTC',
                zone: zone,
                countries: [],
                abbreviation: 'UTC, GMT',
                offsetInMins: 0,
            };
        }
        case InternalTimeZones.default: {
            var tz = getTimeZone();
            var isInternal = tz === 'browser' || tz === 'utc';
            var info = (_a = (isInternal ? mapInternal(tz, timestamp) : mapToInfo(tz, timestamp))) !== null && _a !== void 0 ? _a : {};
            return __assign(__assign({ countries: (_b = countriesByTimeZone[tz]) !== null && _b !== void 0 ? _b : [], abbreviation: '', offsetInMins: 0 }, info), { ianaName: info.ianaName, name: 'Default', zone: zone });
        }
        case InternalTimeZones.localBrowserTime: {
            var tz = moment.tz.guess(true);
            var info = (_c = mapToInfo(tz, timestamp)) !== null && _c !== void 0 ? _c : {};
            return __assign(__assign({ countries: (_d = countriesByTimeZone[tz]) !== null && _d !== void 0 ? _d : [], abbreviation: 'Your local time', offsetInMins: new Date().getTimezoneOffset() }, info), { name: 'Browser Time', ianaName: info.ianaName, zone: zone });
        }
        default:
            return undefined;
    }
};
var abbrevationWithoutOffset = function (abbrevation) {
    if (/^(\+|\-).+/.test(abbrevation)) {
        return '';
    }
    return abbrevation;
};
var mapToInfo = function (timeZone, timestamp) {
    var _a;
    var momentTz = moment.tz.zone(timeZone);
    if (!momentTz) {
        return undefined;
    }
    return {
        name: timeZone,
        ianaName: momentTz.name,
        zone: timeZone,
        countries: (_a = countriesByTimeZone[timeZone]) !== null && _a !== void 0 ? _a : [],
        abbreviation: abbrevationWithoutOffset(momentTz.abbr(timestamp)),
        offsetInMins: momentTz.utcOffset(timestamp),
    };
};
// Country names by ISO 3166-1-alpha-2 code
var countryByCode = {
    AF: 'Afghanistan',
    AX: 'Aland Islands',
    AL: 'Albania',
    DZ: 'Algeria',
    AS: 'American Samoa',
    AD: 'Andorra',
    AO: 'Angola',
    AI: 'Anguilla',
    AQ: 'Antarctica',
    AG: 'Antigua And Barbuda',
    AR: 'Argentina',
    AM: 'Armenia',
    AW: 'Aruba',
    AU: 'Australia',
    AT: 'Austria',
    AZ: 'Azerbaijan',
    BS: 'Bahamas',
    BH: 'Bahrain',
    BD: 'Bangladesh',
    BB: 'Barbados',
    BY: 'Belarus',
    BE: 'Belgium',
    BZ: 'Belize',
    BJ: 'Benin',
    BM: 'Bermuda',
    BT: 'Bhutan',
    BO: 'Bolivia',
    BA: 'Bosnia And Herzegovina',
    BW: 'Botswana',
    BV: 'Bouvet Island',
    BR: 'Brazil',
    IO: 'British Indian Ocean Territory',
    BN: 'Brunei Darussalam',
    BG: 'Bulgaria',
    BF: 'Burkina Faso',
    BI: 'Burundi',
    KH: 'Cambodia',
    CM: 'Cameroon',
    CA: 'Canada',
    CV: 'Cape Verde',
    KY: 'Cayman Islands',
    CF: 'Central African Republic',
    TD: 'Chad',
    CL: 'Chile',
    CN: 'China',
    CX: 'Christmas Island',
    CC: 'Cocos (Keeling) Islands',
    CO: 'Colombia',
    KM: 'Comoros',
    CG: 'Congo',
    CD: 'Congo, Democratic Republic',
    CK: 'Cook Islands',
    CR: 'Costa Rica',
    CI: "Cote D'Ivoire",
    HR: 'Croatia',
    CU: 'Cuba',
    CY: 'Cyprus',
    CZ: 'Czech Republic',
    DK: 'Denmark',
    DJ: 'Djibouti',
    DM: 'Dominica',
    DO: 'Dominican Republic',
    EC: 'Ecuador',
    EG: 'Egypt',
    SV: 'El Salvador',
    GQ: 'Equatorial Guinea',
    ER: 'Eritrea',
    EE: 'Estonia',
    ET: 'Ethiopia',
    FK: 'Falkland Islands (Malvinas)',
    FO: 'Faroe Islands',
    FJ: 'Fiji',
    FI: 'Finland',
    FR: 'France',
    GF: 'French Guiana',
    PF: 'French Polynesia',
    TF: 'French Southern Territories',
    GA: 'Gabon',
    GM: 'Gambia',
    GE: 'Georgia',
    DE: 'Germany',
    GH: 'Ghana',
    GI: 'Gibraltar',
    GR: 'Greece',
    GL: 'Greenland',
    GD: 'Grenada',
    GP: 'Guadeloupe',
    GU: 'Guam',
    GT: 'Guatemala',
    GG: 'Guernsey',
    GN: 'Guinea',
    GW: 'Guinea-Bissau',
    GY: 'Guyana',
    HT: 'Haiti',
    HM: 'Heard Island & Mcdonald Islands',
    VA: 'Holy See (Vatican City State)',
    HN: 'Honduras',
    HK: 'Hong Kong',
    HU: 'Hungary',
    IS: 'Iceland',
    IN: 'India',
    ID: 'Indonesia',
    IR: 'Iran (Islamic Republic Of)',
    IQ: 'Iraq',
    IE: 'Ireland',
    IM: 'Isle Of Man',
    IL: 'Israel',
    IT: 'Italy',
    JM: 'Jamaica',
    JP: 'Japan',
    JE: 'Jersey',
    JO: 'Jordan',
    KZ: 'Kazakhstan',
    KE: 'Kenya',
    KI: 'Kiribati',
    KR: 'Korea',
    KW: 'Kuwait',
    KG: 'Kyrgyzstan',
    LA: "Lao People's Democratic Republic",
    LV: 'Latvia',
    LB: 'Lebanon',
    LS: 'Lesotho',
    LR: 'Liberia',
    LY: 'Libyan Arab Jamahiriya',
    LI: 'Liechtenstein',
    LT: 'Lithuania',
    LU: 'Luxembourg',
    MO: 'Macao',
    MK: 'Macedonia',
    MG: 'Madagascar',
    MW: 'Malawi',
    MY: 'Malaysia',
    MV: 'Maldives',
    ML: 'Mali',
    MT: 'Malta',
    MH: 'Marshall Islands',
    MQ: 'Martinique',
    MR: 'Mauritania',
    MU: 'Mauritius',
    YT: 'Mayotte',
    MX: 'Mexico',
    FM: 'Micronesia (Federated States Of)',
    MD: 'Moldova',
    MC: 'Monaco',
    MN: 'Mongolia',
    ME: 'Montenegro',
    MS: 'Montserrat',
    MA: 'Morocco',
    MZ: 'Mozambique',
    MM: 'Myanmar',
    NA: 'Namibia',
    NR: 'Nauru',
    NP: 'Nepal',
    NL: 'Netherlands',
    AN: 'Netherlands Antilles',
    NC: 'New Caledonia',
    NZ: 'New Zealand',
    NI: 'Nicaragua',
    NE: 'Niger',
    NG: 'Nigeria',
    NU: 'Niue',
    NF: 'Norfolk Island',
    MP: 'Northern Mariana Islands',
    NO: 'Norway',
    OM: 'Oman',
    PK: 'Pakistan',
    PW: 'Palau',
    PS: 'Palestinian Territory (Occupied)',
    PA: 'Panama',
    PG: 'Papua New Guinea',
    PY: 'Paraguay',
    PE: 'Peru',
    PH: 'Philippines',
    PN: 'Pitcairn',
    PL: 'Poland',
    PT: 'Portugal',
    PR: 'Puerto Rico',
    QA: 'Qatar',
    RE: 'Reunion',
    RO: 'Romania',
    RU: 'Russian Federation',
    RW: 'Rwanda',
    BL: 'Saint Barthelemy',
    SH: 'Saint Helena',
    KN: 'Saint Kitts And Nevis',
    LC: 'Saint Lucia',
    MF: 'Saint Martin',
    PM: 'Saint Pierre And Miquelon',
    VC: 'Saint Vincent And Grenadines',
    WS: 'Samoa',
    SM: 'San Marino',
    ST: 'Sao Tome And Principe',
    SA: 'Saudi Arabia',
    SN: 'Senegal',
    RS: 'Serbia',
    SC: 'Seychelles',
    SL: 'Sierra Leone',
    SG: 'Singapore',
    SK: 'Slovakia',
    SI: 'Slovenia',
    SB: 'Solomon Islands',
    SO: 'Somalia',
    ZA: 'South Africa',
    GS: 'South Georgia And Sandwich Isl.',
    ES: 'Spain',
    LK: 'Sri Lanka',
    SD: 'Sudan',
    SR: 'Suriname',
    SJ: 'Svalbard And Jan Mayen',
    SZ: 'Swaziland',
    SE: 'Sweden',
    CH: 'Switzerland',
    SY: 'Syrian Arab Republic',
    TW: 'Taiwan',
    TJ: 'Tajikistan',
    TZ: 'Tanzania',
    TH: 'Thailand',
    TL: 'Timor-Leste',
    TG: 'Togo',
    TK: 'Tokelau',
    TO: 'Tonga',
    TT: 'Trinidad And Tobago',
    TN: 'Tunisia',
    TR: 'Turkey',
    TM: 'Turkmenistan',
    TC: 'Turks And Caicos Islands',
    TV: 'Tuvalu',
    UG: 'Uganda',
    UA: 'Ukraine',
    AE: 'United Arab Emirates',
    GB: 'United Kingdom',
    US: 'United States',
    UM: 'United States Outlying Islands',
    UY: 'Uruguay',
    UZ: 'Uzbekistan',
    VU: 'Vanuatu',
    VE: 'Venezuela',
    VN: 'Viet Nam',
    VG: 'Virgin Islands, British',
    VI: 'Virgin Islands, U.S.',
    WF: 'Wallis And Futuna',
    EH: 'Western Sahara',
    YE: 'Yemen',
    ZM: 'Zambia',
    ZW: 'Zimbabwe',
};
var countriesByTimeZone = (function () {
    return moment.tz.countries().reduce(function (all, code) {
        var timeZones = moment.tz.zonesForCountry(code);
        return timeZones.reduce(function (all, timeZone) {
            if (!all[timeZone]) {
                all[timeZone] = [];
            }
            var name = countryByCode[code];
            if (!name) {
                return all;
            }
            all[timeZone].push({ code: code, name: name });
            return all;
        }, all);
    }, {});
})();
//# sourceMappingURL=timezones.js.map