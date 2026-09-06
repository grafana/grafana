import { t } from '@grafana/i18n';

/**
 * Locale-aware short symbols used by the *renderer* (graphs, legends, single
 * stat panels…) for the built-in value-format categories in `categories.ts`.
 *
 * This is deliberately separate from each format's `name` field in
 * `categories.ts`, which is the long, already-translated label shown in the
 * unit picker dropdown (e.g. "миллиметр (мм)"). This module is only about
 * the short suffix that actually gets drawn next to a number.
 *
 * Every id/`fn:` call shape referenced below was read directly from
 * `categories.ts` on `main` (not inferred from the id's name) — see
 * unitSymbols.review.md in the repo root of this patch for the handful of
 * ids that are deliberately left untranslated and why.
 *
 * Two separate tables, matching two separate mechanisms in categories.ts:
 *
 *  - `PLAIN_UNIT_SYMBOLS` — ids that call `toFixedUnit('<literal>')`
 *    directly. Resolved via `unitSymbol(id)`.
 *  - `SIPREFIX_BASE_UNITS` — ids that call `SIPrefix('<base>', offset)` or
 *    `binaryPrefix('<base>', offset)`. IMPORTANT: several ids share the same
 *    base (e.g. `watt`/`kwatt`/`megwatt`/`gwatt`/`mwatt` are all
 *    `SIPrefix('W', someOffset)` — one auto-scaling family, not five
 *    independent units), so this table intentionally holds the *base unit
 *    only* ("W", not "kW") — the magnitude prefix itself is added
 *    dynamically by `getSIPrefixSymbols()`/`getBinaryPrefixSymbols()` in
 *    `symbolFormatters.ts`, using the *current* value's magnitude, not
 *    whichever offset the id happened to start from. Resolved via
 *    `siPrefixBaseUnit(id)`.
 *
 * Every getter here calls `t()` fresh on every invocation (no memoization),
 * so a value formatted after a live language switch is correct without
 * needing to invalidate `valueFormats.ts`'s `hasBuiltIndex` cache.
 */

interface UnitSymbolEntry {
  /** i18n key, namespaced under grafana-data.valueFormats.symbols.* */
  key: string;
  /** English/source default. Matches the literal categories.ts uses today. */
  en: string;
}

function sym(key: string, en: string): UnitSymbolEntry {
  return { key: `grafana-data.valueFormats.symbols.${key}`, en };
}

// ---------------------------------------------------------------------------
// toFixedUnit('<literal>') ids.
// ---------------------------------------------------------------------------
const PLAIN_UNIT_SYMBOLS: Record<string, UnitSymbolEntry> = {
  accMS2: sym('acceleration.ms2', 'm/sec²'),
  radian: sym('angle.radian', 'rad'),
  grad: sym('angle.gradian', 'grad'),
  arcmin: sym('angle.arcmin', 'arcmin'),
  arcsec: sym('angle.arcsec', 'arcsec'),
  areaM2: sym('area.m2', 'm²'),
  acres: sym('area.acre', 'ac'),
  hectares: sym('area.hectare', 'ha'),
  conngm3: sym('concentration.ngm3', 'ng/m³'),
  conngNm3: sym('concentration.ngNm3', 'ng/Nm³'),
  conmgm3: sym('concentration.mgm3', 'mg/m³'),
  conmgNm3: sym('concentration.mgNm3', 'mg/Nm³'),
  congm3: sym('concentration.gm3', 'g/m³'),
  congNm3: sym('concentration.gNm3', 'g/Nm³'),
  conmgdL: sym('concentration.mgdl', 'mg/dL'),
  conmmolL: sym('concentration.mmoll', 'mmol/L'),
  'conμgm3': sym('concentration.ugm3', 'μg/m³'),
  'conμgNm3': sym('concentration.ugNm3', 'μg/Nm³'),
  litreh: sym('flow.lh', 'L/h'),
  flowlpm: sym('flow.lmin', 'L/min'),
  flowmlpm: sym('flow.mlmin', 'mL/min'),
  lux: sym('light.lux', 'lux'),
  pressurehpa: sym('pressure.hpa', 'hPa'),
  pressurekpa: sym('pressure.kpa', 'kPa'),
  masst: sym('mass.tonne', 't'),
  lengthcm: sym('length.cm', 'cm'),
  rotrpm: sym('rotation.rpm', 'rpm'),
  rotrads: sym('rotation.rads', 'rad/s'),
  rotdegs: sym('rotation.degs', '°/s'),
  velocityms: sym('velocity.ms', 'm/s'),
  velocitykmh: sym('velocity.kmh', 'km/h'),
  velocityknot: sym('velocity.knot', 'kn'),
  m3: sym('volume.m3', 'm³'),
  Nm3: sym('volume.nm3', 'Nm³'),
  dm3: sym('volume.dm3', 'dm³'),
};

// ---------------------------------------------------------------------------
// SIPrefix('<base>', offset) / binaryPrefix('<base>', offset) ids. Grouped
// by which ids share the same base (see the big comment above) — every id
// in a group maps to the SAME key/en pair on purpose.
// ---------------------------------------------------------------------------
const SI_GENERIC = sym('misc.si-generic', '');
const CANDELA = sym('misc.candela', 'cd');
const WATT = sym('power.watt', 'W');
const WM2 = sym('power.wm2', 'W/m²');
const VA = sym('power.va', 'VA');
const VAR = sym('power.var', 'VAr');
const WH = sym('energy.wh', 'Wh');
const W_MIN = sym('energy.wmin', 'W-Min');
const WH_KG = sym('energy.whkg', 'Wh/kg');
const AH = sym('electrical.ah', 'Ah');
const JOULE = sym('energy.joule', 'J');
const EV = sym('energy.ev', 'eV');
const AMP = sym('electrical.amp', 'A');
const VOLT = sym('electrical.volt', 'V');
const OHM = sym('electrical.ohm', 'Ω');
const FARAD = sym('electrical.farad', 'F');
const HENRY = sym('electrical.henry', 'H');
const LUMEN = sym('light.lumen', 'Lm');
const FORCE_NM = sym('force.nm', 'Nm');
const FORCE_N = sym('force.n', 'N');
const GRAM = sym('mass.gram', 'g');
const METER = sym('length.meter', 'm');
const LITRE = sym('volume.litre', 'L');
const BAR = sym('pressure.bar', 'bar');
const PASCAL = sym('pressure.pa', 'Pa');
const BECQUEREL = sym('radiation.bq', 'Bq');
const CURIE = sym('radiation.ci', 'Ci');
const GRAY = sym('radiation.gy', 'Gy');
const RAD_UNIT = sym('radiation.rad', 'rad');
const SIEVERT = sym('radiation.sv', 'Sv');
const REM = sym('radiation.rem', 'rem');
const C_PER_KG = sym('radiation.ckg', 'C/kg');
const ROENTGEN = sym('radiation.roentgen', 'R');
const SIEVERT_H = sym('radiation.svh', 'Sv/h');
const HERTZ = sym('frequency.hertz', 'Hz');
const BYTE = sym('data.byte', 'B');
const BIT = sym('data.bit', 'b');
const BYTE_PS = sym('data.byteps', 'B/s');
const BIT_PS = sym('data.bitps', 'b/s');

const SIPREFIX_BASE_UNITS: Record<string, UnitSymbolEntry> = {
  sishort: SI_GENERIC,
  candela: CANDELA,

  watt: WATT,
  kwatt: WATT,
  megwatt: WATT,
  gwatt: WATT,
  mwatt: WATT,
  Wm2: WM2,
  voltamp: VA,
  kvoltamp: VA,
  voltampreact: VAR,
  kvoltampreact: VAR,
  watth: WH,
  kwatth: WH,
  mwatth: WH,
  kwattm: W_MIN,
  watthperkg: WH_KG,
  amph: AH,
  kamph: AH,
  mamph: AH,
  joule: JOULE,
  ev: EV,
  amp: AMP,
  kamp: AMP,
  mamp: AMP,
  volt: VOLT,
  kvolt: VOLT,
  mvolt: VOLT,
  mohm: OHM,
  ohm: OHM,
  kohm: OHM,
  Mohm: OHM,
  farad: FARAD,
  'µfarad': FARAD,
  nfarad: FARAD,
  pfarad: FARAD,
  ffarad: FARAD,
  henry: HENRY,
  mhenry: HENRY,
  'µhenry': HENRY,
  lumens: LUMEN,
  forceNm: FORCE_NM,
  forcekNm: FORCE_NM,
  forceN: FORCE_N,
  forcekN: FORCE_N,
  massmg: GRAM,
  massg: GRAM,
  masskg: GRAM,
  lengthmm: METER,
  lengthm: METER,
  lengthkm: METER,
  mlitre: LITRE,
  litre: LITRE,
  pressurembar: BAR,
  pressurebar: BAR,
  pressurekbar: BAR,
  pressurepa: PASCAL,
  radbq: BECQUEREL,
  radci: CURIE,
  radgy: GRAY,
  radrad: RAD_UNIT,
  radsv: SIEVERT,
  radmsv: SIEVERT,
  radusv: SIEVERT,
  radrem: REM,
  radexpckg: C_PER_KG,
  radr: ROENTGEN,
  radsvh: SIEVERT_H,
  radmsvh: SIEVERT_H,
  radusvh: SIEVERT_H,
  hertz: HERTZ,
  rothz: HERTZ,
  rotkhz: HERTZ,
  rotmhz: HERTZ,
  rotghz: HERTZ,

  bytes: BYTE,
  kbytes: BYTE,
  mbytes: BYTE,
  gbytes: BYTE,
  tbytes: BYTE,
  pbytes: BYTE,
  decbytes: BYTE,
  deckbytes: BYTE,
  decmbytes: BYTE,
  decgbytes: BYTE,
  dectbytes: BYTE,
  decpbytes: BYTE,
  bits: BIT,
  decbits: BIT,

  binBps: BYTE_PS,
  Bps: BYTE_PS,
  KiBs: BYTE_PS,
  KBs: BYTE_PS,
  MiBs: BYTE_PS,
  MBs: BYTE_PS,
  GiBs: BYTE_PS,
  GBs: BYTE_PS,
  TiBs: BYTE_PS,
  TBs: BYTE_PS,
  PiBs: BYTE_PS,
  PBs: BYTE_PS,
  binbps: BIT_PS,
  bps: BIT_PS,
  Kibits: BIT_PS,
  Kbits: BIT_PS,
  Mibits: BIT_PS,
  Mbits: BIT_PS,
  Gibits: BIT_PS,
  Gbits: BIT_PS,
  Tibits: BIT_PS,
  Tbits: BIT_PS,
  Pibits: BIT_PS,
  Pbits: BIT_PS,

  // NOTE: 'flops'..'yflops' (base 'FLOPS'), 'Hs'..'EHs' (base 'H/s', likely
  // a hashrate unit rather than hertz — unconfirmed) and 'pps' (base 'p/s')
  // are intentionally NOT listed here — see unitSymbols.review.md. Leaving
  // them out of this table means the codemod will not touch their call
  // sites at all, so they keep today's plain-ASCII SIPrefix behavior.
};

/**
 * Russian (ru-RU) values, following ГОСТ 8.417-2002 (Russian State Standard
 * for units of measurement) where it defines a symbol, and well-established
 * common usage otherwise (e.g. "Кбит/с"). Keyed by the i18n key (not the
 * id), since several ids intentionally share one key. This is what should
 * land in `public/locales/ru-RU/grafana.json` — see `scripts/gen-locale-json.js`.
 */
export const RU_RU_VALUES: Record<string, string> = {
  'grafana-data.valueFormats.symbols.acceleration.ms2': 'м/с²',
  'grafana-data.valueFormats.symbols.angle.radian': 'рад',
  'grafana-data.valueFormats.symbols.angle.gradian': 'град',
  'grafana-data.valueFormats.symbols.angle.arcmin': 'угл. мин',
  'grafana-data.valueFormats.symbols.angle.arcsec': 'угл. с',
  'grafana-data.valueFormats.symbols.area.m2': 'м²',
  'grafana-data.valueFormats.symbols.area.acre': 'акр',
  'grafana-data.valueFormats.symbols.area.hectare': 'га',
  'grafana-data.valueFormats.symbols.concentration.ngm3': 'нг/м³',
  'grafana-data.valueFormats.symbols.concentration.ngNm3': 'нг/нм³',
  'grafana-data.valueFormats.symbols.concentration.mgm3': 'мг/м³',
  'grafana-data.valueFormats.symbols.concentration.mgNm3': 'мг/нм³',
  'grafana-data.valueFormats.symbols.concentration.gm3': 'г/м³',
  'grafana-data.valueFormats.symbols.concentration.gNm3': 'г/нм³',
  'grafana-data.valueFormats.symbols.concentration.mgdl': 'мг/дл',
  'grafana-data.valueFormats.symbols.concentration.mmoll': 'ммоль/л',
  'grafana-data.valueFormats.symbols.concentration.ugm3': 'мкг/м³',
  'grafana-data.valueFormats.symbols.concentration.ugNm3': 'мкг/нм³',
  'grafana-data.valueFormats.symbols.flow.lh': 'л/ч',
  'grafana-data.valueFormats.symbols.flow.lmin': 'л/мин',
  'grafana-data.valueFormats.symbols.flow.mlmin': 'мл/мин',
  'grafana-data.valueFormats.symbols.light.lux': 'лк',
  'grafana-data.valueFormats.symbols.pressure.hpa': 'гПа',
  'grafana-data.valueFormats.symbols.pressure.kpa': 'кПа',
  'grafana-data.valueFormats.symbols.mass.tonne': 'т',
  'grafana-data.valueFormats.symbols.length.cm': 'см',
  'grafana-data.valueFormats.symbols.rotation.rpm': 'об/мин',
  'grafana-data.valueFormats.symbols.rotation.rads': 'рад/с',
  'grafana-data.valueFormats.symbols.rotation.degs': '°/с',
  'grafana-data.valueFormats.symbols.velocity.ms': 'м/с',
  'grafana-data.valueFormats.symbols.velocity.kmh': 'км/ч',
  'grafana-data.valueFormats.symbols.velocity.knot': 'уз',
  'grafana-data.valueFormats.symbols.volume.m3': 'м³',
  'grafana-data.valueFormats.symbols.volume.nm3': 'нм³',
  'grafana-data.valueFormats.symbols.volume.dm3': 'дм³',

  'grafana-data.valueFormats.symbols.misc.si-generic': '',
  'grafana-data.valueFormats.symbols.misc.candela': 'кд',
  'grafana-data.valueFormats.symbols.power.watt': 'Вт',
  'grafana-data.valueFormats.symbols.power.wm2': 'Вт/м²',
  'grafana-data.valueFormats.symbols.power.va': 'ВА',
  'grafana-data.valueFormats.symbols.power.var': 'вар',
  'grafana-data.valueFormats.symbols.energy.wh': 'Вт·ч',
  // NOTE: bare base unit, matching en 'W-Min' — SIPrefix(..., 1) supplies the
  // 'к'/'М'/... magnitude prefix dynamically. A baked-in 'к' here would double
  // up with that dynamic prefix (e.g. "ккВт·мин"). Found by Cursor Bugbot.
  'grafana-data.valueFormats.symbols.energy.wmin': 'Вт·мин',
  'grafana-data.valueFormats.symbols.energy.whkg': 'Вт·ч/кг',
  'grafana-data.valueFormats.symbols.electrical.ah': 'А·ч',
  'grafana-data.valueFormats.symbols.energy.joule': 'Дж',
  'grafana-data.valueFormats.symbols.energy.ev': 'эВ',
  'grafana-data.valueFormats.symbols.electrical.amp': 'А',
  'grafana-data.valueFormats.symbols.electrical.volt': 'В',
  'grafana-data.valueFormats.symbols.electrical.ohm': 'Ом',
  'grafana-data.valueFormats.symbols.electrical.farad': 'Ф',
  'grafana-data.valueFormats.symbols.electrical.henry': 'Гн',
  'grafana-data.valueFormats.symbols.light.lumen': 'лм',
  'grafana-data.valueFormats.symbols.force.nm': 'Н·м',
  'grafana-data.valueFormats.symbols.force.n': 'Н',
  'grafana-data.valueFormats.symbols.mass.gram': 'г',
  'grafana-data.valueFormats.symbols.length.meter': 'м',
  'grafana-data.valueFormats.symbols.volume.litre': 'л',
  'grafana-data.valueFormats.symbols.pressure.bar': 'бар',
  'grafana-data.valueFormats.symbols.pressure.pa': 'Па',
  'grafana-data.valueFormats.symbols.radiation.bq': 'Бк',
  'grafana-data.valueFormats.symbols.radiation.ci': 'Ки',
  'grafana-data.valueFormats.symbols.radiation.gy': 'Гр',
  'grafana-data.valueFormats.symbols.radiation.rad': 'рад',
  'grafana-data.valueFormats.symbols.radiation.sv': 'Зв',
  'grafana-data.valueFormats.symbols.radiation.rem': 'бэр',
  'grafana-data.valueFormats.symbols.radiation.ckg': 'Кл/кг',
  'grafana-data.valueFormats.symbols.radiation.roentgen': 'Р',
  'grafana-data.valueFormats.symbols.radiation.svh': 'Зв/ч',
  'grafana-data.valueFormats.symbols.frequency.hertz': 'Гц',
  'grafana-data.valueFormats.symbols.data.byte': 'Б',
  'grafana-data.valueFormats.symbols.data.bit': 'бит',
  'grafana-data.valueFormats.symbols.data.byteps': 'Б/с',
  'grafana-data.valueFormats.symbols.data.bitps': 'бит/с',

  'grafana-data.valueFormats.symbols.scale.thousand': 'тыс',
  'grafana-data.valueFormats.symbols.scale.million': 'млн',
  'grafana-data.valueFormats.symbols.scale.billion': 'млрд',
  'grafana-data.valueFormats.symbols.scale.trillion': 'трлн',
  'grafana-data.valueFormats.symbols.scale.quadrillion': 'квадрлн',
  'grafana-data.valueFormats.symbols.scale.quintillion': 'квинтлн',
  'grafana-data.valueFormats.symbols.scale.sextillion': 'секстлн',
  'grafana-data.valueFormats.symbols.scale.septillion': 'септлн',

  'grafana-data.valueFormats.symbols.bool.true': 'Истина',
  'grafana-data.valueFormats.symbols.bool.false': 'Ложь',
  'grafana-data.valueFormats.symbols.bool.yes': 'Да',
  'grafana-data.valueFormats.symbols.bool.no': 'Нет',
  'grafana-data.valueFormats.symbols.bool.on': 'Вкл',
  'grafana-data.valueFormats.symbols.bool.off': 'Выкл',

  // SI prefixes (ГОСТ 8.417-2002)
  'grafana-data.valueFormats.siPrefixes.femto': 'ф',
  'grafana-data.valueFormats.siPrefixes.pico': 'п',
  'grafana-data.valueFormats.siPrefixes.nano': 'н',
  'grafana-data.valueFormats.siPrefixes.micro': 'мк',
  'grafana-data.valueFormats.siPrefixes.milli': 'м',
  'grafana-data.valueFormats.siPrefixes.base': '',
  'grafana-data.valueFormats.siPrefixes.kilo': 'к',
  'grafana-data.valueFormats.siPrefixes.mega': 'М',
  'grafana-data.valueFormats.siPrefixes.giga': 'Г',
  'grafana-data.valueFormats.siPrefixes.tera': 'Т',
  'grafana-data.valueFormats.siPrefixes.peta': 'П',
  'grafana-data.valueFormats.siPrefixes.exa': 'Э',
  'grafana-data.valueFormats.siPrefixes.zetta': 'З',
  'grafana-data.valueFormats.siPrefixes.yotta': 'И',

  // Note: IEC binary prefixes (Ki/Mi/Gi/...) are deliberately NOT translated —
  // see getBinaryPrefixSymbols() below. No ru-RU entries needed here.
};

/** Resolves the translated display text for a `toFixedUnit`-based id. */
export function unitSymbol(id: string): string {
  const entry = PLAIN_UNIT_SYMBOLS[id];
  if (!entry) {
    return id;
  }
  return t(entry.key, entry.en);
}

/**
 * Resolves the translated *base unit only* (no prefix) for an id driven by
 * `SIPrefix()`/`binaryPrefix()`. Never feed this into anything other than
 * those two functions — the prefix is added separately, dynamically, per
 * rendered value.
 */
export function siPrefixBaseUnit(id: string): string {
  const entry = SIPREFIX_BASE_UNITS[id];
  if (!entry) {
    return id;
  }
  return t(entry.key, entry.en);
}

/** SI decimal prefixes, in the exact order `symbolFormatters.ts`'s ASCII `SI_PREFIXES` uses. */
export function getSIPrefixSymbols(): string[] {
  return [
    t('grafana-data.valueFormats.siPrefixes.femto', 'f'),
    t('grafana-data.valueFormats.siPrefixes.pico', 'p'),
    t('grafana-data.valueFormats.siPrefixes.nano', 'n'),
    t('grafana-data.valueFormats.siPrefixes.micro', 'µ'),
    t('grafana-data.valueFormats.siPrefixes.milli', 'm'),
    t('grafana-data.valueFormats.siPrefixes.base', ''),
    t('grafana-data.valueFormats.siPrefixes.kilo', 'k'),
    t('grafana-data.valueFormats.siPrefixes.mega', 'M'),
    t('grafana-data.valueFormats.siPrefixes.giga', 'G'),
    t('grafana-data.valueFormats.siPrefixes.tera', 'T'),
    t('grafana-data.valueFormats.siPrefixes.peta', 'P'),
    t('grafana-data.valueFormats.siPrefixes.exa', 'E'),
    t('grafana-data.valueFormats.siPrefixes.zetta', 'Z'),
    t('grafana-data.valueFormats.siPrefixes.yotta', 'Y'),
  ];
}

/**
 * IEC binary prefixes, in the exact order `symbolFormatters.ts`'s ASCII
 * `BIN_PREFIXES` uses. Deliberately identical to `BIN_PREFIXES` in every
 * locale: unlike SI decimal prefixes, Ki/Mi/Gi/Ti/... have no standard
 * Cyrillic abbreviation in ГОСТ 8.417-2002 (it predates IEC 80000-13), and
 * are commonly used as-is (Latin) in Russian-language technical writing —
 * confirmed with the user. The base unit they attach to (Б, бит, ...) is
 * still translated separately via `siPrefixBaseUnit()`.
 */
export function getBinaryPrefixSymbols(): string[] {
  return ['', 'Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei', 'Zi', 'Yi'];
}

/** "short" (Misc category) magnitude words: '', K, Mil, Bil, Tri, … */
export function shortScaleWords(): string[] {
  const words = [
    t('grafana-data.valueFormats.symbols.scale.thousand', 'K'),
    t('grafana-data.valueFormats.symbols.scale.million', 'Mil'),
    t('grafana-data.valueFormats.symbols.scale.billion', 'Bil'),
    t('grafana-data.valueFormats.symbols.scale.trillion', 'Tri'),
    t('grafana-data.valueFormats.symbols.scale.quadrillion', 'Quadr'),
    t('grafana-data.valueFormats.symbols.scale.quintillion', 'Quint'),
    t('grafana-data.valueFormats.symbols.scale.sextillion', 'Sext'),
    t('grafana-data.valueFormats.symbols.scale.septillion', 'Sept'),
  ];
  return ['', ...words.map((w) => ' ' + w)];
}

// booleanValueFormatter takes two independent strings, not a single id, so
// these are standalone thunks (already shaped as `() => string`, i.e.
// directly assignable wherever `UnitLike` is expected) rather than going
// through `unitSymbol()`.
export const boolTrue = (): string => t('grafana-data.valueFormats.symbols.bool.true', 'True');
export const boolFalse = (): string => t('grafana-data.valueFormats.symbols.bool.false', 'False');
export const boolYes = (): string => t('grafana-data.valueFormats.symbols.bool.yes', 'Yes');
export const boolNo = (): string => t('grafana-data.valueFormats.symbols.bool.no', 'No');
export const boolOn = (): string => t('grafana-data.valueFormats.symbols.bool.on', 'On');
export const boolOff = (): string => t('grafana-data.valueFormats.symbols.bool.off', 'Off');

// Exported for the codemod / tests / gen-locale-json.js.
export { PLAIN_UNIT_SYMBOLS, SIPREFIX_BASE_UNITS };
