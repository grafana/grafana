// Info: https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
interface Locale {
  name: string;
  code: string;
}

// TODO re-check translations
export const LOCALES: Locale[] = [
  // Afrikaans - Standard
  { name: 'Afrikaans', code: 'af' },
  // Arabic - Standard
  { name: 'العربية', code: 'ar' },
  // Arabic - Algeria
  { name: 'العربية (الجزائر)', code: 'ar-DZ' },
  // Arabic - Kuwait
  { name: 'العربية (الكويت)', code: 'ar-KW' },
  // Arabic - Libya
  { name: 'العربية (ليبيا)', code: 'ar-LY' },
  // Arabic - Morocco
  { name: 'العربية (المغرب)', code: 'ar-MA' },
  // Arabic - Palestine
  { name: 'العربية (فلسطين)', code: 'ar-PS' },
  // Arabic - Saudi Arabia
  { name: 'العربية (السعودية)', code: 'ar-SA' },
  // Arabic - Tunisia
  { name: 'العربية (تونس)', code: 'ar-TN' },
  // Azerbaijani - Azerbaijan
  { name: 'Azərbaycan dili', code: 'az' },
  // Belarusian - Belarus
  { name: 'Беларуская мова', code: 'be-BY' },
  // Bulgarian - Bulgaria
  { name: 'Български език', code: 'bg-BG' },
  // Bambara - Mali
  { name: 'Bamanankan', code: 'bm' },
  // Bengali - Standard
  { name: 'বাংলা', code: 'bn' },
  // Bengali - Bangladesh
  { name: 'বাংলা', code: 'bn-BD' },
  // Tibetan - Tibet (China) and Bhutan
  { name: 'བོད་ཡིག', code: 'bo' },
  // Breton - Brittany (France)
  { name: 'Brezhoneg', code: 'br' },
  // Bosnian - Bosnia and Herzegovina
  { name: 'Bosanski jezik', code: 'bs' },
  // Catalan - Catalonia (Spain)
  { name: 'Català', code: 'ca-ES' },
  // Czech - Czech Republic
  { name: 'Čeština', code: 'cs-CZ' },
  // Welsh - Wales (United Kingdom)
  { name: 'Cymraeg', code: 'cy-GB' },
  // Chuvash - Chuvashia (Russia)
  { name: 'Чӑвашла', code: 'cv-RU' },
  // Danish - Denmark
  { name: 'Dansk', code: 'da-DK' },
  // German - Germany
  { name: 'Deutsch', code: 'de-DE' },
  // German - Austria
  { name: 'Deutsch (Österreich)', code: 'de-AT' },
  // German - Switzerland
  { name: 'Deutsch (Schweiz)', code: 'de-CH' },
  // Divehi/Maldivian - Maldives
  { name: 'ދިވެހި', code: 'dv-MV' },
  // Greek - Greece
  { name: 'Ελληνικά', code: 'el-GR' },
  // English - Australia
  { name: 'English (Australia)', code: 'en-AU' },
  // English - Canada
  { name: 'English (Canada)', code: 'en-CA' },
  // English - United Kingdom
  { name: 'English (United Kingdom)', code: 'en-GB' },
  // English - Ireland
  { name: 'English (Ireland)', code: 'en-IE' },
  // English - Israel
  { name: 'English (Israel)', code: 'en-IL' },
  // English - India
  { name: 'English (India)', code: 'en-IN' },
  // English - New Zealand
  { name: 'English (New Zealand)', code: 'en-NZ' },
  // English - Singapore
  { name: 'English (Singapore)', code: 'en-SG' },
  // English - United States
  { name: 'English (United States)', code: 'en-US' },
  // Esperanto - International Auxiliary Language
  { name: 'Esperanto', code: 'eo' },
  // Spanish - Spain
  { name: 'Español', code: 'es-ES' },
  // Spanish - Dominican Republic
  { name: 'Español (República Dominicana)', code: 'es-DO' },
  // Spanish - Mexico
  { name: 'Español (México)', code: 'es-MX' },
  // Spanish - United States
  { name: 'Español (Estados Unidos)', code: 'es-US' },
  // Estonian - Estonia
  { name: 'Eesti keel', code: 'et-EE' },
  // Basque - Basque Country
  { name: 'Euskara', code: 'eu-ES' },
  // Persian - Iran
  { name: 'فارسی', code: 'fa-IR' },
  // Filipino - Philippines
  { name: 'Wikang Filipino', code: 'fil-PH' },
  // Finnish - Finland
  { name: 'Suomi', code: 'fi-FI' },
  // Faroese - Faroe Islands
  { name: 'Føroyskt', code: 'fo-FO' },
  // French - France
  { name: 'Français', code: 'fr-FR' },
  // French - Canada
  { name: 'Français (Canada)', code: 'fr-CA' },
  // French - Switzerland
  { name: 'Français (Suisse)', code: 'fr-CH' },
  // West Frisian - Netherlands
  { name: 'Frysk', code: 'fy' },
  // Irish - Ireland
  { name: 'Gaeilge', code: 'ga-IE' },
  // Scottish Gaelic - Scotland (UK)
  { name: 'Gàidhlig', code: 'gd-GB' },
  // Galician - Galicia (Spain)
  { name: 'Galego', code: 'gl-ES' },
  // Konkani (Devanagari script) - India
  { name: 'कोंकणी', code: 'gom-Deva' },
  // Konkani (Latin script) - India
  { name: 'Konkani', code: 'gom-Latn' },
  // Gujarati - India
  { name: 'ગુજરાતી', code: 'gu-IN' },
  // Hebrew - Israel
  { name: 'עברית', code: 'he-IL' },
  // Hindi - India
  { name: 'हिन्दी', code: 'hi' },
  // Croatian - Croatia
  { name: 'Hrvatski jezik', code: 'hr' },
  // Hungarian - Hungary
  { name: 'Magyar nyelv', code: 'hu-HU' },
  // Armenian - Armenia
  { name: 'Հայերեն', code: 'hy-AM' },
  // Indonesian - Indonesia
  { name: 'Bahasa Indonesia', code: 'id-ID' },
  // Icelandic - Iceland
  { name: 'Íslenska', code: 'is-IS' },
  // Italian - Italy
  { name: 'Italiano', code: 'it-IT' },
  // Italian - Switzerland
  { name: 'Italiano (Svizzera)', code: 'it-CH' },
  // Japanese - Japan
  { name: '日本語', code: 'ja-JP' },
  // Javanese - Indonesia
  { name: 'ꦧꦱꦗꦮ', code: 'jv' },
  // Georgian - Georgia
  { name: 'ქართული ენა', code: 'ka-GE' },
  // Kazakh - Kazakhstan
  { name: 'Қазақ тілі', code: 'kk-KZ' },
  // Khmer - Cambodia
  { name: 'ខ្មែរ', code: 'km-KH' },
  // Kannada - India
  { name: 'ಕನ್ನಡ', code: 'kn-IN' },
  // Korean - South Korea
  { name: '한국어', code: 'ko-KR' },
  // Kurdish - Kurdistan (Iraq, Iran, Syria, Turkey)
  { name: 'Kurdî', code: 'ku' },
  // Kyrgyz - Kyrgyzstan
  { name: 'Кыргыз тили', code: 'ky-KG' },
  // Luxembourgish - Luxembourg
  { name: 'Lëtzebuergesch', code: 'lb-LU' },
  // Lao - Laos
  { name: 'ພາສາລາວ', code: 'lo-LA' },
  // Lithuanian - Lithuania
  { name: 'Lietuvių kalba', code: 'lt-LT' },
  // Latvian - Latvia
  { name: 'Latviešu valoda', code: 'lv-LV' },
  // Macedonian - North Macedonia
  { name: 'Македонски јазик', code: 'mk-MK' },
  // Malayalam - Kerala (India)
  { name: 'മലയാളം', code: 'ml-IN' },
  // Māori - New Zealand
  { name: 'Te Reo Māori', code: 'mi-NZ' },
  // Montenegrin - Montenegro
  { name: 'Црногорски језик', code: 'cnr-ME' },
  // Marathi - Maharashtra (India)
  { name: 'मराठी', code: 'mr' },
  // Malay - Malaysia, Singapore, Brunei
  { name: 'Bahasa Melayu', code: 'ms' },
  // Maltese - Malta
  { name: 'Malti', code: 'mt-MT' },
  // Mongolian - Mongolia
  { name: 'Монгол хэл', code: 'mn-MN' },
  // Burmese - Myanmar
  { name: 'မြန်မာစာ', code: 'my-MM' },
  // Norwegian Bokmål - Norway
  { name: 'Norsk bokmål', code: 'nb' },
  // Nepali - Nepal and India
  { name: 'नेपाली', code: 'ne' },
  // Dutch - Netherlands
  { name: 'Nederlands', code: 'nl-NL' },
  // Dutch - Belgium (Flemish)
  { name: 'Nederlands (België)', code: 'nl-BE' },
  // Norwegian Nynorsk - Norway
  { name: 'Nynorsk', code: 'nn-NO' },
  // Occitan - Southern France, Monaco, Italy
  { name: 'Occitan', code: 'oc' },
  // Punjabi - Punjab (India and Pakistan)
  { name: 'ਪੰਜਾਬੀ', code: 'pa' },
  // Polish - Poland
  { name: 'Polski', code: 'pl-PL' },
  // Portuguese - Portugal
  { name: 'Português', code: 'pt-PT' },
  // Portuguese - Brazil
  { name: 'Português (Brasil)', code: 'pt-BR' },
  // Romanian - Romania
  { name: 'Română', code: 'ro-RO' },
  // Russian - Russia
  { name: 'Русский язык', code: 'ru-RU' },
  // Northern Sami - Northern Scandinavia
  { name: 'Davvisámegiella', code: 'se' },
  // Sindhi - Pakistan and India
  { name: 'سنڌي', code: 'sd' },
  // Sinhala - Sri Lanka
  { name: 'සිංහල', code: 'si-LK' },
  // Slovak - Slovakia
  { name: 'Slovenský jazyk', code: 'sk-SK' },
  // Slovenian - Slovenia
  { name: 'Slovenski jezik', code: 'sl-SI' },
  // Albanian - Albania, Kosovo
  { name: 'Shqip', code: 'sq' },
  // Serbian - Serbia (Default)
  { name: 'Српски', code: 'sr' },
  // Serbian - Serbia (Cyrillic script)
  { name: 'Српски (ћирилица)', code: 'sr-Cyrl' },
  // Swati - Eswatini (Swaziland)
  { name: 'SiSwati', code: 'ss' },
  // Swahili - East Africa
  { name: 'Kiswahili', code: 'sw' },
  // Swedish - Sweden
  { name: 'Svenska', code: 'sv' },
  // Tamil - Tamil Nadu (India), Sri Lanka, Singapore
  { name: 'தமிழ்', code: 'ta' },
  // Telugu - Andhra Pradesh, Telangana (India)
  { name: 'తెలుగు', code: 'te' },
  // Tetum - East Timor
  { name: 'Tetun', code: 'tet' },
  // Tajik - Tajikistan
  { name: 'Тоҷикӣ', code: 'tg' },
  // Thai - Thailand
  { name: 'ภาษาไทย', code: 'th-TH' },
  // Turkmen - Turkmenistan
  { name: 'Türkmen dili', code: 'tk-TM' },
  // Tagalog - Philippines
  { name: 'Wikang Tagalog', code: 'tl-PH' },
  // Klingon - Constructed Language (Star Trek)
  { name: 'tlhIngan Hol', code: 'tlh' },
  // Turkish - Turkey
  { name: 'Türkçe', code: 'tr-TR' },
  // Talossan - Constructed Language
  { name: 'Talossan', code: 'tzl' },
  // Tamazight (Tifinagh script) - North Africa
  { name: 'ⵜⴰⵎⴰⵣⵉⵖⵜ', code: 'tzm' },
  // Tamazight (Latin script) - North Africa
  { name: 'Tamazight', code: 'tzm-Latn' },
  // Uyghur - Xinjiang (China)
  { name: 'ئۇيغۇرچە', code: 'ug-CN' },
  // Ukrainian - Ukraine
  { name: 'Українська мова', code: 'uk-UA' },
  // Urdu - Pakistan and India
  { name: 'اردو', code: 'ur-PK' },
  // Uzbek - Uzbekistan (Cyrillic script)
  { name: 'Ўзбек тили', code: 'uz-UZ' },
  // Uzbek - Uzbekistan (Latin script)
  { name: "O'zbek tili", code: 'uz-Latn' },
  // Vietnamese - Vietnam
  { name: 'Tiếng Việt', code: 'vi-VN' },
  // Chinese - China
  { name: '中文', code: 'zh-CN' },
  // Chinese - Simplified
  { name: '简体中文', code: 'zh-Hans' },
  // Chinese - Traditional
  { name: '繁體中文', code: 'zh-Hant' },
  // Chinese - Hong Kong
  { name: '中文 (香港)', code: 'zh-HK' },
  // Chinese - Taiwan
  { name: '正體中文 (台灣)', code: 'zh-TW' },
  // Chinese - Macau
  { name: '中文 (澳門)', code: 'zh-MO' },
  // Yoruba - Nigeria, Benin, Togo
  { name: 'Yorùbá', code: 'yo' },
];
