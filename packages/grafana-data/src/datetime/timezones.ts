import { memoize } from 'lodash';
import moment from 'moment-timezone';

import { TimeZone } from '../types';

import { getTimeZone } from './common';

export enum InternalTimeZones {
  default = '',
  localBrowserTime = 'browser',
  utc = 'utc',
}

export const timeZoneFormatUserFriendly = (timeZone: TimeZone | undefined) => {
  switch (getTimeZone({ timeZone })) {
    case 'browser':
      return 'Local browser time';
    case 'utc':
      return 'UTC';
    default:
      return timeZone;
  }
};

export interface TimeZoneCountry {
  code: string;
  name: string;
}
export interface TimeZoneInfo {
  name: string;
  zone: string;
  countries: TimeZoneCountry[];
  abbreviation: string;
  offsetInMins: number;
  ianaName: string;
}

export interface GroupedTimeZones {
  name: string;
  zones: TimeZone[];
}

export const getTimeZoneInfo = (zone: string, timestamp: number): TimeZoneInfo | undefined => {
  const internal = mapInternal(zone, timestamp);

  if (internal) {
    return internal;
  }

  return mapToInfo(zone, timestamp);
};

export const getTimeZones = memoize((includeInternal: boolean | InternalTimeZones[] = false): TimeZone[] => {
  const initial: TimeZone[] = [];

  if (includeInternal === true) {
    initial.push(InternalTimeZones.default, InternalTimeZones.localBrowserTime, InternalTimeZones.utc);
  } else if (includeInternal) {
    initial.push(...includeInternal);
  }

  return moment.tz.names().reduce((zones: TimeZone[], zone: string) => {
    const countriesForZone = countriesByTimeZone[zone];

    if (!Array.isArray(countriesForZone) || countriesForZone.length === 0) {
      return zones;
    }

    zones.push(zone);
    return zones;
  }, initial);
});

export const getTimeZoneGroups = memoize(
  (includeInternal: boolean | InternalTimeZones[] = false): GroupedTimeZones[] => {
    const timeZones = getTimeZones(includeInternal);

    const groups = timeZones.reduce((groups: Record<string, TimeZone[]>, zone: TimeZone) => {
      const delimiter = zone.indexOf('/');

      if (delimiter === -1) {
        const group = '';
        groups[group] = groups[group] ?? [];
        groups[group].push(zone);

        return groups;
      }

      const group = zone.slice(0, delimiter);
      groups[group] = groups[group] ?? [];
      groups[group].push(zone);

      return groups;
    }, {});

    return Object.keys(groups).map((name) => ({
      name,
      zones: groups[name],
    }));
  }
);

const mapInternal = (zone: string, timestamp: number): TimeZoneInfo | undefined => {
  switch (zone) {
    case InternalTimeZones.utc: {
      return {
        name: 'Coordinated Universal Time',
        ianaName: 'UTC',
        zone,
        countries: [],
        abbreviation: 'UTC, GMT',
        offsetInMins: 0,
      };
    }

    case InternalTimeZones.default: {
      const tz = getTimeZone();
      const isInternal = tz === 'browser' || tz === 'utc';
      const info = (isInternal ? mapInternal(tz, timestamp) : mapToInfo(tz, timestamp)) ?? {};

      return {
        countries: countriesByTimeZone[tz] ?? [],
        abbreviation: '',
        offsetInMins: 0,
        ...info,
        ianaName: (info as TimeZoneInfo).ianaName,
        name: 'Default',
        zone,
      };
    }

    case InternalTimeZones.localBrowserTime: {
      const tz = moment.tz.guess(true);
      const info = mapToInfo(tz, timestamp) ?? {};

      return {
        countries: countriesByTimeZone[tz] ?? [],
        abbreviation: 'Your local time',
        offsetInMins: new Date().getTimezoneOffset(),
        ...info,
        name: 'Browser Time',
        ianaName: (info as TimeZoneInfo).ianaName,
        zone,
      };
    }

    default:
      return undefined;
  }
};

const abbrevationWithoutOffset = (abbrevation: string): string => {
  if (/^(\+|\-).+/.test(abbrevation)) {
    return '';
  }
  return abbrevation;
};

const mapToInfo = (timeZone: TimeZone, timestamp: number): TimeZoneInfo | undefined => {
  const momentTz = moment.tz.zone(timeZone);
  if (!momentTz) {
    return undefined;
  }

  return {
    name: timeZone,
    ianaName: momentTz.name,
    zone: timeZone,
    countries: countriesByTimeZone[timeZone] ?? [],
    abbreviation: abbrevationWithoutOffset(momentTz.abbr(timestamp)),
    offsetInMins: momentTz.utcOffset(timestamp),
  };
};

// Country names by ISO 3166-1-alpha-2 code
const countryByCode: Record<string, string> = {
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
  PS: 'Palestine, State of',
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

const countriesByTimeZone = ((): Record<string, TimeZoneCountry[]> => {
  return moment.tz.countries().reduce((all: Record<string, TimeZoneCountry[]>, code) => {
    const timeZones = moment.tz.zonesForCountry(code);
    return timeZones.reduce((all: Record<string, TimeZoneCountry[]>, timeZone) => {
      if (!all[timeZone]) {
        all[timeZone] = [];
      }

      const name = countryByCode[code];

      if (!name) {
        return all;
      }

      all[timeZone].push({ code, name });
      return all;
    }, all);
  }, {});
})();
