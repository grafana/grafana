// List hard-coded locales from https://github.com/moment/moment/tree/develop/locale

interface Locale {
  name: string;
  code: string;
}

// TODO re-check translations
export const LOCALES: Locale[] = [
  { name: 'Afrikaans', code: 'af-ZA' },
  { name: 'العربية', code: 'ar' }, // Region???
  { name: 'العربية (الجزائر)', code: 'ar-DZ' },
  { name: 'العربية (الكويت)', code: 'ar-KW' },
  { name: 'العربية (ليبيا)', code: 'ar-LY' },
  { name: 'العربية (المغرب)', code: 'ar-MA' },
  { name: 'العربية (فلسطين)', code: 'ar-PS' },
  { name: 'العربية (السعودية)', code: 'ar-SA' },
  { name: 'العربية (تونس)', code: 'ar-TN' },
  { name: 'Azərbaycanca', code: 'az-AZ' },
  { name: 'Беларуская', code: 'be-BY' },
  { name: 'български език', code: 'bg-BG' },
  { name: 'Bamanankan', code: 'bm' },
  { name: 'Bengali', code: 'bn' }, // TODO translate : বাংলা ??? Region???
  { name: 'Bengali (Bangladesh)', code: 'bn-BD' }, // TODO translate
  { name: 'Tibetan', code: 'bo' }, // TODO translate ///Region???
  { name: 'Brezhoneg', code: 'br' },
  { name: 'Босански', code: 'bs' },
  { name: 'Catalán', code: 'ca-ES' },
  { name: 'Čeština', code: 'cs-CZ' },
  { name: 'Cymraeg', code: 'cy-GB' },
  { name: 'Чӑвашла', code: 'cv' },
  { name: 'Dansk', code: 'da-DK' },
  { name: 'Deutsch', code: 'de-DE' },
  { name: 'Deutsch (Österreich)', code: 'de-AT' },
  { name: 'Deutsch (Schweiz)', code: 'de-CH' },
  { name: 'ދިވެހި', code: 'dv-MV' },
  { name: 'Ελληνικά', code: 'el-GR' },
  { name: 'English (Australia)', code: 'en-AU' },
  { name: 'English (Canada)', code: 'en-CA' },
  { name: 'English (United Kingdom)', code: 'en-GB' },
  { name: 'English (Ireland)', code: 'en-IE' },
  { name: 'English (Israel)', code: 'en-IL' },
  { name: 'English (India)', code: 'en-IN' },
  { name: 'English (New Zealand)', code: 'en-NZ' },
  { name: 'English (Singapore)', code: 'en-SG' },
  { name: 'English (United States)', code: 'en-US' },
  { name: 'Esperanto', code: 'eo' },
  { name: 'Español', code: 'es-ES' },
  { name: 'Español (República Dominicana)', code: 'es-DO' },
  { name: 'Español (México)', code: 'es-MX' },
  { name: 'Español (Estados Unidos)', code: 'es-US' },
  { name: 'Eesti keel', code: 'et-EE' },
  { name: 'Euskara', code: 'eu-ES' },
  { name: 'فارسی', code: 'fa-IR' },
  { name: 'Filipino', code: 'fil' },
  { name: 'Suomi', code: 'fi-FI' },
  { name: 'Føroyskt', code: 'fo-FO' },
  { name: 'Français', code: 'fr-FR' },
  { name: 'Français (Canada)', code: 'fr-CA' },
  { name: 'Français (Suisse)', code: 'fr-CH' },
  { name: 'Frisian', code: 'fy' }, // TODO translate
  { name: 'Gaeilge', code: 'ga-IE' },
  { name: 'Gàidhlig', code: 'gd' },
  { name: 'Galego', code: 'gl-ES' },
  { name: 'Konkani Devanagari', code: 'gom-deva' }, // TODO translate
  { name: 'Konkani Latin', code: 'gom-latn' }, // TODO translate
  { name: 'ગુજરાતી', code: 'gu' },
  { name: 'עברית', code: 'he-IL' },
  { name: 'हिन्दी', code: 'hi-IN' },
  { name: 'Hrvatski', code: 'hr-HR' },
  { name: 'Magyar', code: 'hu-HU' },
  { name: 'Հայերեն', code: 'hy-AM' },
  { name: 'Bahasa Indonesia', code: 'id-ID' },
  { name: 'Íslenska', code: 'is-IS' },
  { name: 'Italiano', code: 'it-IT' },
  { name: 'Italiano (Switzerland)', code: 'it-CH' },
  { name: '日本語', code: 'ja-JP' },
  { name: 'ꦧꦱꦗꦮ', code: 'jv' },
  { name: 'ქართული', code: 'ka-GE' },
  { name: 'Қазақ Tілі', code: 'kk-KZ' },
  { name: 'Cambodian', code: 'km' }, // TODO translate
  { name: 'ಕನ್ನಡ', code: 'kn-IN' },
  { name: '한국어', code: 'ko-KR' },
  { name: 'Kurdish', code: 'ku' }, // TODO translate
  { name: 'Northern Kurdish', code: 'ku' }, // TODO translate =>>> Repeated
  { name: 'Кыргыз тили', code: 'ky-KG' },
  { name: 'Lëtzebuergesch', code: 'lb' },
  { name: 'ພາສາລາວ', code: 'lo' },
  { name: 'Lietuvių', code: 'lt-LT' },
  { name: 'latviešu', code: 'lv-LV' },
  { name: 'Mакедонски', code: 'mk-MK' },
  { name: 'മലയാളം', code: 'ml' },
  { name: 'te Reo Māori', code: 'mi' },
  { name: 'crnogorski', code: 'me' },
  { name: 'मराठी', code: 'mr-IN' },
  { name: 'Bahasa Melayu', code: 'ms-MY' },
  { name: 'Malti', code: 'mt-MT' },
  { name: 'Монгол Хэл', code: 'mn-MN' },
  { name: 'Burmese', code: 'my' }, // TODO trasnlate: မြန်မာစာ ??
  { name: 'Norwegian Bokmål', code: 'nb-NO' }, // TODO translate
  { name: 'नेपाली', code: 'ne' },
  { name: 'Nederlands', code: 'nl-NL' },
  { name: 'Nederlands (België)', code: 'nl-BE' },
  { name: 'Ninorks', code: 'nn-NO' }, //??
  { name: 'Occitan (Lengadocian)', code: 'oc-lnc' },
  { name: 'पंजाबी (ਭਾਰਤ)', code: 'pa-IN' },
  { name: 'Polski', code: 'pl-PL' },
  { name: 'Português', code: 'pt-PT' },
  { name: 'Português (Brasil)', code: 'pt-BR' },
  { name: 'Română', code: 'ro-RO' },
  { name: 'Русский', code: 'ru-RU' },
  { name: 'Nothern Sami', code: 'se-SE' }, // TODO translate
  { name: 'سنڌي', code: 'sd' },
  { name: 'සිංහල', code: 'si' },
  { name: 'Slovenčina', code: 'sk-SK' },
  { name: 'Slovenščina', code: 'sl-SL' },
  { name: 'Shqip', code: 'sq-AL' },
  { name: 'Српски', code: 'sr' },
  { name: 'Serbian Cyrillic', code: 'sr-cyrl' }, // TODO translate
  { name: 'siSwati', code: 'ss' },
  { name: 'Kiswahili', code: 'sw-KE' },
  { name: 'Svenska', code: 'sv' },
  { name: 'தமிழ்', code: 'ta-IN' },
  { name: 'తెలుగు', code: 'te-IN' },
  { name: 'Lia-Tetun', code: 'tet' },
  { name: 'Тоҷикӣ', code: 'tg' },
  { name: 'ภาษาไทย', code: 'th-TH' },
  { name: 'Türkmençe', code: 'tk' },
  { name: 'Tagalog (Philippines)', code: 'tl-PH' }, // TODO translate
  { name: 'tlhIngan Hol', code: 'tlh' },
  { name: 'Türkçe', code: 'tr-TR' },
  { name: 'Talossan', code: 'tzl' }, // TODO translate
  { name: 'أمازيغية أطلس الأوسط', code: 'tzm' },
  { name: 'Central Atlas Tamazight Latin', code: 'tzm-latn' }, // TODO translate
  { name: 'ئۇيغۇر تىلى', code: 'ug-CN' },
  { name: 'Українська', code: 'uk-UA' },
  { name: 'اُردُو', code: 'ur-PK' },
  { name: 'Ўзбек', code: 'uz-UZ' },
  { name: 'Uzbek (Latin)', code: 'uz-latn' }, // TODO translate
  { name: 'tiếng Việt', code: 'vi-VN' },
  { name: 'Chinese (China)', code: 'zh-CN' }, // TODO translate
  { name: 'Chinese (Hong Kong)', code: 'zh-HK' }, // TODO translate
  { name: 'Chinese (Macau)', code: 'zh-MO' }, // TODO translate
  { name: 'Chinese (Taiwan)', code: 'zh-TW' }, // TODO translate
  { name: 'Èdè Yorùbá', code: 'yo-NG' },
];
