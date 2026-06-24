import { memoize } from 'lodash';

import { type TimeZone } from '@grafana/schema';

import { getTimeZone } from './common';

export enum InternalTimeZones {
  default = '',
  localBrowserTime = 'browser',
  utc = 'utc',
}

/**
 * @deprecated
 */
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

interface TimeZoneOffsetInfo {
  name: string;
  utcOffset: (timestamp: number) => number;
}

export const getZone = (timeZone: string): TimeZoneOffsetInfo | undefined => {
  const ianaName = getCanonicalTimeZone(timeZone);

  if (!ianaName) {
    return undefined;
  }

  return {
    name: ianaName,
    utcOffset: (timestamp: number) => getTimeZoneOffsetInMinutes(timestamp, ianaName),
  };
};

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

  return initial.concat(Intl.supportedValuesOf('timeZone') ?? []);
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
      const isInternal = tz === InternalTimeZones.localBrowserTime || tz === InternalTimeZones.utc;
      const info = isInternal ? mapInternal(tz, timestamp) : mapToInfo(tz, timestamp);

      return {
        countries: [],
        abbreviation: '',
        offsetInMins: 0,
        ...info,
        ianaName: info?.ianaName ?? '',
        name: 'Default',
        zone,
      };
    }

    case InternalTimeZones.localBrowserTime: {
      const tz = getBrowserTimeZone();
      const info = mapToInfo(tz, timestamp);

      return {
        countries: [],
        abbreviation: 'Your local time',
        offsetInMins: new Date().getTimezoneOffset(),
        ...info,
        name: 'Browser Time',
        ianaName: info?.ianaName ?? '',
        zone,
      };
    }

    default:
      return undefined;
  }
};

const mapToInfo = (timeZone: TimeZone, timestamp: number): TimeZoneInfo | undefined => {
  const ianaName = getCanonicalTimeZone(timeZone);

  if (!ianaName) {
    return undefined;
  }

  return {
    name: timeZone,
    ianaName,
    zone: timeZone,
    countries: [],
    abbreviation: getTimeZoneAbbreviation(timestamp, ianaName),
    offsetInMins: getTimeZoneOffsetInMinutes(timestamp, ianaName),
  };
};

const getBrowserTimeZone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

const getCanonicalTimeZone = (timeZone: string): string | undefined => {
  try {
    return Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

const getTimeZoneOffsetInMinutes = (timestamp: number, timeZone: string): number => {
  const offset = getTimeZoneNamePart(timestamp, timeZone, 'shortOffset');
  const match = /^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(offset);

  if (!match) {
    return 0;
  }

  const [, sign, hours, minutes = '0'] = match;
  const offsetInMinutes = Number(hours) * 60 + Number(minutes);

  return sign === '+' ? -offsetInMinutes : offsetInMinutes;
};

const getTimeZoneAbbreviation = (timestamp: number, timeZone: string): string => {
  const shortName = getTimeZoneNamePart(timestamp, timeZone, 'short');

  if (isTimeZoneAbbreviation(shortName)) {
    return shortName;
  }

  const longName = getTimeZoneNamePart(timestamp, timeZone, 'long');
  const abbreviationFromName = getTimeZoneNameAcronym(longName);

  if (isTimeZoneAbbreviation(abbreviationFromName)) {
    return abbreviationFromName;
  }

  return getKnownAbbreviationForTimeZone(timeZone) ?? '';
};

const getTimeZoneNamePart = (
  timestamp: number,
  timeZone: string,
  timeZoneName: Intl.DateTimeFormatOptions['timeZoneName']
): string => {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName,
    })
      .formatToParts(timestamp)
      .find((part) => part.type === 'timeZoneName')?.value ?? ''
  );
};

const isTimeZoneAbbreviation = (value: string): boolean => {
  return timeZoneAbbreviations.has(value);
};

const getTimeZoneNameAcronym = (timeZoneName: string): string => {
  return timeZoneName
    .split(/[\s&()-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

const getKnownAbbreviationForTimeZone = (timeZone: string): string | undefined => {
  return Object.entries(timeZoneNamesByAbbreviation).find(([, timeZones]) => timeZones.includes(timeZone))?.[0];
};

const timeZoneNamesByAbbreviation: Record<string, string[]> = {
  ACDT: ['Australia/Adelaide'],
  ACST: ['Australia/Adelaide', 'Australia/Darwin'],
  ACWST: ['Australia/Eucla'],
  ADT: ['America/Halifax'],
  AEDT: ['Australia/Sydney', 'Australia/Melbourne'],
  AEST: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane'],
  AFT: ['Asia/Kabul'],
  AKDT: ['America/Anchorage'],
  AKST: ['America/Anchorage'],
  ALMT: ['Asia/Almaty'],
  AMST: ['America/Manaus'],
  AMT: ['America/Manaus', 'Asia/Yerevan'],
  ANAT: ['Asia/Anadyr'],
  ART: ['America/Argentina/Buenos_Aires'],
  AST: ['America/Halifax', 'America/Puerto_Rico'],
  AWST: ['Australia/Perth'],
  AZOST: ['Atlantic/Azores'],
  AZOT: ['Atlantic/Azores'],
  AZT: ['Asia/Baku'],
  BNT: ['Asia/Brunei'],
  BOT: ['America/La_Paz'],
  BRST: ['America/Sao_Paulo'],
  BRT: ['America/Sao_Paulo'],
  BST: ['Europe/London', 'Asia/Dhaka'],
  CAT: ['Africa/Maputo'],
  CDT: ['America/Chicago', 'America/Havana'],
  CEST: ['Europe/Stockholm', 'Europe/Berlin', 'Europe/Paris', 'Europe/Rome'],
  CET: ['Europe/Stockholm', 'Europe/Berlin', 'Europe/Paris', 'Europe/Rome', 'Africa/Algiers'],
  CHADT: ['Pacific/Chatham'],
  CHAST: ['Pacific/Chatham'],
  CHST: ['Pacific/Guam'],
  CKT: ['Pacific/Rarotonga'],
  CLST: ['America/Santiago'],
  CLT: ['America/Santiago'],
  COT: ['America/Bogota'],
  CST: ['America/Chicago', 'America/Havana', 'Asia/Shanghai'],
  CVT: ['Atlantic/Cape_Verde'],
  CXT: ['Indian/Christmas'],
  DAVT: ['Antarctica/Davis'],
  DDUT: ['Antarctica/DumontDUrville'],
  EASST: ['Pacific/Easter'],
  EAST: ['Pacific/Easter'],
  EAT: ['Africa/Nairobi'],
  ECT: ['America/Guayaquil'],
  EDT: ['America/New_York'],
  EEST: ['Europe/Bucharest', 'Europe/Kyiv', 'Europe/Helsinki'],
  EET: ['Europe/Bucharest', 'Europe/Kyiv', 'Europe/Helsinki', 'Africa/Cairo'],
  EST: ['America/New_York', 'America/Panama'],
  FJT: ['Pacific/Fiji'],
  FKST: ['Atlantic/Stanley'],
  FKT: ['Atlantic/Stanley'],
  GALT: ['Pacific/Galapagos'],
  GAMT: ['Pacific/Gambier'],
  GET: ['Asia/Tbilisi'],
  GFT: ['America/Cayenne'],
  GILT: ['Pacific/Tarawa'],
  GMT: ['Etc/GMT', 'Europe/London'],
  GST: ['Asia/Dubai', 'Atlantic/South_Georgia'],
  GYT: ['America/Guyana'],
  HDT: ['Pacific/Honolulu'],
  HKT: ['Asia/Hong_Kong'],
  HOVT: ['Asia/Hovd'],
  HST: ['Pacific/Honolulu'],
  ICT: ['Asia/Bangkok'],
  IDT: ['Asia/Jerusalem'],
  IRDT: ['Asia/Tehran'],
  IRKT: ['Asia/Irkutsk'],
  IRST: ['Asia/Tehran'],
  IST: ['Asia/Kolkata', 'Europe/Dublin', 'Asia/Jerusalem'],
  JST: ['Asia/Tokyo'],
  KGT: ['Asia/Bishkek'],
  KOST: ['Pacific/Kosrae'],
  KRAT: ['Asia/Krasnoyarsk'],
  KST: ['Asia/Seoul'],
  LHDT: ['Australia/Lord_Howe'],
  LHST: ['Australia/Lord_Howe'],
  LINT: ['Pacific/Kiritimati'],
  MAGT: ['Asia/Magadan'],
  MART: ['Pacific/Marquesas'],
  MDT: ['America/Denver'],
  MHT: ['Pacific/Majuro'],
  MMT: ['Asia/Yangon'],
  MSK: ['Europe/Moscow'],
  MST: ['America/Denver', 'America/Phoenix'],
  MUT: ['Indian/Mauritius'],
  MVT: ['Indian/Maldives'],
  MYT: ['Asia/Kuala_Lumpur'],
  NCT: ['Pacific/Noumea'],
  NDT: ['America/St_Johns'],
  NFDT: ['Pacific/Norfolk'],
  NFT: ['Pacific/Norfolk'],
  NOVT: ['Asia/Novosibirsk'],
  NPT: ['Asia/Kathmandu'],
  NRT: ['Pacific/Nauru'],
  NST: ['America/St_Johns'],
  NUT: ['Pacific/Niue'],
  NZDT: ['Pacific/Auckland'],
  NZST: ['Pacific/Auckland'],
  OMST: ['Asia/Omsk'],
  PDT: ['America/Los_Angeles'],
  PET: ['America/Lima'],
  PGT: ['Pacific/Port_Moresby'],
  PHT: ['Asia/Manila'],
  PHOT: ['Pacific/Enderbury'],
  PKT: ['Asia/Karachi'],
  PMDT: ['America/Miquelon'],
  PMST: ['America/Miquelon'],
  PONT: ['Pacific/Pohnpei'],
  PST: ['America/Los_Angeles', 'Pacific/Pitcairn'],
  PWT: ['Pacific/Palau'],
  PYST: ['America/Asuncion'],
  PYT: ['America/Asuncion'],
  RET: ['Indian/Reunion'],
  SAKT: ['Asia/Sakhalin'],
  SAMT: ['Europe/Samara'],
  SAST: ['Africa/Johannesburg'],
  SBT: ['Pacific/Guadalcanal'],
  SCT: ['Indian/Mahe'],
  SDT: ['Pacific/Apia'],
  SGT: ['Asia/Singapore'],
  SLST: ['Asia/Colombo'],
  SRT: ['America/Paramaribo'],
  SST: ['Pacific/Apia', 'Pacific/Pago_Pago'],
  SYOT: ['Antarctica/Syowa'],
  TAHT: ['Pacific/Tahiti'],
  TFT: ['Indian/Kerguelen'],
  TJT: ['Asia/Dushanbe'],
  TKT: ['Pacific/Fakaofo'],
  TLT: ['Asia/Dili'],
  TMT: ['Asia/Ashgabat'],
  TOT: ['Pacific/Tongatapu'],
  TVT: ['Pacific/Funafuti'],
  UTC: ['UTC'],
  UYT: ['America/Montevideo'],
  UZT: ['Asia/Tashkent'],
  VET: ['America/Caracas'],
  VLAT: ['Asia/Vladivostok'],
  VOLT: ['Europe/Volgograd'],
  VOST: ['Antarctica/Vostok'],
  VUT: ['Pacific/Efate'],
  WAKT: ['Pacific/Wake'],
  WAT: ['Africa/Lagos'],
  WEST: ['Atlantic/Canary', 'Europe/Lisbon'],
  WET: ['Atlantic/Canary', 'Europe/Lisbon'],
  WFT: ['Pacific/Wallis'],
  WGST: ['America/Godthab'],
  WGT: ['America/Godthab'],
  WIB: ['Asia/Jakarta'],
  WIT: ['Asia/Jayapura'],
  WITA: ['Asia/Makassar'],
  WST: ['Africa/El_Aaiun'],
  WT: ['Africa/El_Aaiun'],
  YAKT: ['Asia/Yakutsk'],
  YEKT: ['Asia/Yekaterinburg'],
};

const timeZoneAbbreviations = new Set(Object.keys(timeZoneNamesByAbbreviation));
