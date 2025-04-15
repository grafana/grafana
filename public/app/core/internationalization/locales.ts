// List hard-coded locales from https://github.com/moment/moment/tree/develop/locale

interface Locale {
  name: string;
  code: string;
}

// TODO re-check translations
export const LOCALES: Locale[] = [
  { name: 'Afrikaans', code: 'af' },
  { name: 'العربية', code: 'ar' },
  { name: 'العربية (الجزائر)', code: 'ar-dz' },
  { name: 'العربية (الكويت)', code: 'ar-kw' },
  { name: 'العربية (ليبيا)', code: 'ar-ly' },
  { name: 'العربية (المغرب)', code: 'ar-ma' },
  { name: 'العربية (فلسطين)', code: 'ar-ps' },
  { name: 'العربية (السعودية)', code: 'ar-sa' },
  { name: 'العربية (تونس)', code: 'ar-tn' },
  { name: 'Azərbaycanca', code: 'az' },
  { name: 'Беларуская', code: 'be' },
  { name: 'български език', code: 'bg' },
  { name: 'Bamanankan', code: 'bm' },
  { name: 'Bengali', code: 'bn' }, // TODO translate : বাংলা ???
  { name: 'Bengali (Bangladesh)', code: 'bn-bd' }, // TODO translate
  { name: 'Tibetan', code: 'bo' }, // TODO translate
  { name: 'Brezhoneg', code: 'br' },
  { name: 'Босански', code: 'bs' },
  { name: 'Catalán', code: 'ca' },
  { name: 'Čeština', code: 'cs' },
  { name: 'Cymraeg', code: 'cy' },
  { name: 'Чӑвашла', code: 'cv' },
  { name: 'Dansk', code: 'da' },
  { name: 'Deutsch', code: 'de' },
  { name: 'Deutsch (Österreich)', code: 'de-at' },
  { name: 'Deutsch (Schweiz)', code: 'de-ch' },
  { name: 'ދިވެހި', code: 'dv' },
  { name: 'Ελληνικά', code: 'el' },
  { name: 'English (Australia)', code: 'en-au' },
  { name: 'English (Canada)', code: 'en-ca' },
  { name: 'English (United Kingdom)', code: 'en-gb' },
  { name: 'English (Ireland)', code: 'en-ie' },
  { name: 'English (Israel)', code: 'en-il' },
  { name: 'English (India)', code: 'en-in' },
  { name: 'English (New Zealand)', code: 'en-nz' },
  { name: 'English (Singapore)', code: 'en-sg' },
  { name: 'English (United States)', code: 'en' },
  { name: 'Esperanto', code: 'eo' },
  { name: 'Español', code: 'es' },
  { name: 'Español (República Dominicana)', code: 'es-do' },
  { name: 'Español (México)', code: 'es-mx' },
  { name: 'Español (Estados Unidos)', code: 'es-us' },
  { name: 'Eesti keel', code: 'et' },
  { name: 'Euskara', code: 'eu' },
  { name: 'فارسی', code: 'fa' },
  { name: 'Filipino', code: 'fil' },
  { name: 'Suomi', code: 'fi' },
  { name: 'Føroyskt', code: 'fo' },
  { name: 'Français', code: 'fr' },
  { name: 'Français (Canada)', code: 'fr-ca' },
  { name: 'Français (Suisse)', code: 'fr-ch' },
  { name: 'Frisian', code: 'fy' }, // TODO translate
  { name: 'Gaeilge', code: 'ga' },
  { name: 'Gàidhlig', code: 'gd' },
  { name: 'Galego', code: 'gl' },
  { name: 'Konkani Devanagari', code: 'gom-deva' }, // TODO translate
  { name: 'Konkani Latin', code: 'gom-latn' }, // TODO translate
  { name: 'ગુજરાતી', code: 'gu' },
  { name: 'עברית', code: 'he' },
  { name: 'हिन्दी', code: 'hi' },
  { name: 'Hrvatski', code: 'hr' },
  { name: 'Magyar', code: 'hu' },
  { name: 'Հայերեն', code: 'hy-am' },
  { name: 'Bahasa Indonesia', code: 'id' },
  { name: 'Íslenska', code: 'is' },
  { name: 'Italiano', code: 'it' },
  { name: 'Italiano (Switzerland)', code: 'it-ch' },
  { name: '日本語', code: 'ja' },
  { name: 'ꦧꦱꦗꦮ', code: 'jv' },
  { name: 'ქართული', code: 'ka' },
  { name: 'Қазақ Tілі', code: 'kk' },
  { name: 'Cambodian', code: 'km' }, // TODO translate
  { name: 'ಕನ್ನಡ', code: 'kn' },
  { name: '한국어', code: 'ko' },
  { name: 'Kurdish', code: 'ku' }, // TODO translate
  { name: 'Northern Kurdish', code: 'ku' }, // TODO translate
  { name: 'Кыргыз тили', code: 'ky' },
  { name: 'Lëtzebuergesch', code: 'lb' },
  { name: 'ພາສາລາວ', code: 'lo' },
  { name: 'Lietuvių', code: 'lt' },
  { name: 'latviešu', code: 'lv' },
  { name: 'Mакедонски', code: 'mk' },
  { name: 'മലയാളം', code: 'ml' },
  { name: 'te Reo Māori', code: 'mi' },
  { name: 'crnogorski', code: 'me' },
  { name: 'मराठी', code: 'mr' },
  { name: 'Bahasa Melayu', code: 'ms' },
  { name: 'Malti', code: 'mt' },
  { name: 'Монгол Хэл', code: 'mn' },
  { name: 'Burmese', code: 'my' }, // TODO trasnlate: မြန်မာစာ ??
  { name: 'Norwegian Bokmål', code: 'nb' }, // TODO translate
  { name: 'नेपाली', code: 'ne' },
  { name: 'Nederlands', code: 'nl' },
  { name: 'Nederlands (België)', code: 'nl-be' },
  { name: 'Ninorks', code: 'nn' }, //??
  { name: 'Occitan (Lengadocian)', code: 'oc-lnc' },
  { name: 'पंजाबी (ਭਾਰਤ)', code: 'pa-in' },
  { name: 'Polski', code: 'pl' },
  { name: 'Português', code: 'pt' },
  { name: 'Português (Brasil)', code: 'pt-br' },
  { name: 'Română', code: 'ro' },
  { name: 'Русский', code: 'ru' },
  { name: 'Nothern Sami', code: 'se' }, // TODO translate
  { name: 'سنڌي', code: 'sd' },
  { name: 'සිංහල', code: 'si' },
  { name: 'Slovenčina', code: 'sk' },
  { name: 'Slovenščina', code: 'sl' },
  { name: 'Shqip', code: 'sq' },
  { name: 'Српски', code: 'sr' },
  { name: 'Serbian Cyrillic', code: 'sr-cyrl' }, // TODO translate
  { name: 'siSwati', code: 'ss' },
  { name: 'Kiswahili', code: 'sw' },
  { name: 'Svenska', code: 'sv' },
  { name: 'தமிழ்', code: 'ta' },
  { name: 'తెలుగు', code: 'te' },
  { name: 'Lia-Tetun', code: 'tet' },
  { name: 'Тоҷикӣ', code: 'tg' },
  { name: 'ภาษาไทย', code: 'th' },
  { name: 'Türkmençe', code: 'tk' },
  { name: 'Tagalog (Philippines)', code: 'tl-ph' }, // TODO translate
  { name: 'tlhIngan Hol', code: 'tlh' },
  { name: 'Türkçe', code: 'tr' },
  { name: 'Talossan', code: 'tzl' }, // TODO translate
  { name: 'أمازيغية أطلس الأوسط', code: 'tzm' },
  { name: 'Central Atlas Tamazight Latin', code: 'tzm-latn' }, // TODO translate
  { name: 'ئۇيغۇر تىلى', code: 'ug-cn' },
  { name: 'Українська', code: 'uk' },
  { name: 'اُردُو', code: 'ur' },
  { name: 'Ўзбек', code: 'uz' },
  { name: 'Uzbek (Latin)', code: 'uz-latn' }, // TODO translate
  { name: 'tiếng Việt', code: 'vi' },
  { name: 'Chinese (China)', code: 'zh-cn' }, // TODO translate
  { name: 'Chinese (Hong Kong)', code: 'zh-hk' }, // TODO translate
  { name: 'Chinese (Macau)', code: 'zh-mo' }, // TODO translate
  { name: 'Chinese (Taiwan)', code: 'zh-tw' }, // TODO translate
  { name: 'Èdè Yorùbá', code: 'yo-ng' },
];
