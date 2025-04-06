// List hard-coded locales from https://github.com/moment/moment/tree/develop/locale

interface Locale {
    name: string;
    code: string;
}

// TODO re-check translations
export const LOCALES: Locale[] = [
    { name: 'Afrikaans', code: 'af' }, 
    { name: 'Shqip', code: 'sq' },
    { name: 'العربية', code: 'ar' },
    { name: 'العربية (الجزائر)', code: 'ar-dz' },
    { name: 'العربية (الكويت)', code: 'ar-kw' },
    { name: 'العربية (ليبيا)', code: 'ar-ly' },
    { name: 'العربية (المغرب)', code: 'ar-ma' },
    { name: 'العربية (فلسطين)', code: 'ar-ps' },
    { name: 'العربية (السعودية)', code: 'ar-sa' },
    { name: 'العربية (تونس)', code: 'ar-tn' },
    { name: 'Հայերեն', code: 'hy-am' },
    { name: 'Azərbaycanca', code: 'az'},
    { name: 'Bamanankan', code: 'bm'},
    { name: 'Euskara', code: 'eu'},
    { name: 'Беларуская', code: 'be'},
    { name: 'Bengali', code: 'bn'}, // TODO translate : বাংলা ???
    { name: 'Bengali (Bangladesh)', code: 'bn-bd'}, // TODO translate
    { name: 'Босански', code: 'bs'},
    { name: 'Brezhoneg', code: 'br'},
    { name: 'български език', code: 'bg'},
    { name: 'Burmese', code: 'my'}, // TODO trasnlate: မြန်မာစာ ??
    { name: 'Cambodian', code: 'km'}, // TODO translate
    { name: 'Catalán', code: 'ca'},
    { name: 'أمازيغية أطلس الأوسط', code: 'tzm'},
    { name: 'Central Atlas Tamazight Latin', code: 'tzm-latn'}, // TODO translate
    { name: 'Chinese (China)', code: 'zh-cn'}, // TODO translate
    { name: 'Chinese (Hong Kong)', code: 'zh-hk'}, // TODO translate
    { name: 'Chinese (Macau)', code: 'zh-mo'}, // TODO translate
    { name: 'Chinese (Taiwan)', code: 'zh-tw'}, // TODO translate
    { name: 'Чӑвашла', code: 'cv'},
    { name: 'Hrvatski', code: 'hr'},
    { name: 'Čeština', code: 'cs'},
    { name: 'Nederlands', code: 'nl'},
    { name: 'Nederlands (België)', code: 'nl-be'},
    { name: 'Dansk', code: 'da'},
    { name: 'Deutsch (Österreich)', code: 'de-at'},
    { name: 'Deutsch (Schweiz)', code: 'de-ch'},
    { name: 'Deutsch', code: 'de'},
    { name: 'Ελληνικά', code: 'el'},
    { name: 'English (Australia)', code: 'en-au'},
    { name: 'English (Canada)', code: 'en-ca'},
    { name: 'English (United Kingdom)', code: 'en-gb'},
    { name: 'English (Ireland)', code: 'en-ie'},
    { name: 'English (Israel)', code: 'en-il'},
    { name: 'English (India)', code: 'en-in'},
    { name: 'English (New Zealand)', code: 'en-nz'},
    { name: 'English (Singapore)', code: 'en-sg'},
    { name: 'Esperanto', code: 'eo'},
    { name: 'Eesti keel', code: 'et'},
    { name: 'Føroyskt', code: 'fo'},
    { name: 'Filipino', code: 'fil'},
    { name: 'Suomi', code: 'fi'},
    { name: 'Français', code: 'fr'},
    { name: 'Français (Canada)', code: 'fr-ca'},
    { name: 'Français (Suisse)', code: 'fr-ch'},
    { name: 'Frisian', code: 'fy'}, // TODO translate
    { name: 'Galego', code: 'gl'},
    { name: 'ქართული', code: 'ka'},
    { name: 'ગુજરાતી', code: 'gu'},
    { name: 'עברית', code: 'he'},
    { name: 'हिन्दी', code: 'hi'},
    { name: 'Íslenska', code: 'is'},
    { name: 'Bahasa Indonesia', code: 'id'},
    { name: 'Gaeilge', code: 'ga'},
    { name: 'Italiano', code: 'it'},
    { name: 'Italiano (Switzerland)', code: 'it-ch'},
    { name: '日本語', code: 'ja'},
    { name: 'ꦧꦱꦗꦮ', code: 'jv'},
    { name: 'ಕನ್ನಡ', code: 'kn'},
    { name: 'Қазақ Tілі', code: 'kk'},
    { name: 'tlhIngan Hol', code: 'tlh'},
    { name: 'Konkani Devanagari', code: 'gom-deva'}, // TODO translate
    { name: 'Konkani Latin', code: 'gom-latn'}, // TODO translate
    { name: '한국어', code: 'ko'},
    { name: 'Kurdish', code: 'ku'}, // TODO translate
    { name: 'Кыргыз тили', code: 'ky'},
    { name: 'ພາສາລາວ', code: 'lo'},
    { name: 'latviešu', code: 'lv'},
    { name: 'Lietuvių', code: 'lt'},
    { name: 'Lëtzebuergesch', code: 'lb'},
    { name: 'Mакедонски', code: 'mk'},
    { name: 'Magyar', code: 'hu'},
    { name: 'Bahasa Melayu', code: 'ms'},
    { name: 'മലയാളം', code: 'ml'},
    { name: 'ދިވެހި', code: 'dv'},
    { name: 'Malti', code: 'mt'},
    { name: 'मराठी', code: 'mr'},
    { name: 'te Reo Māori', code: 'mi'},
    { name: 'crnogorski', code: 'me'},
    { name: 'Монгол Хэл', code: 'mn'},
    { name: 'नेपाली', code: 'ne'},
    { name: 'Ninorks', code: 'nn'}, //??
    { name: 'Northern Kurdish', code: 'ku'}, // TODO translate
    { name: 'Nothern Sami', code: 'se'}, // TODO translate
    { name: 'Norwegian Bokmål', code: 'nb'}, // TODO translate
    { name: 'Occitan (Lengadocian)', code: 'oc-lnc'},
    { name: 'فارسی', code: 'fa'},
    { name: 'Polski', code: 'pl'},
    { name: 'Português', code: 'pt'},
    { name: 'Português (Brasil)', code: 'pt-br'},
    { name: 'पंजाबी (ਭਾਰਤ)', code: 'pa-in'},
    { name: 'Română', code: 'ro'},
    { name: 'Русский', code: 'ru'},
    { name: 'Српски', code: 'sr'},
    { name: 'Serbian Cyrillic', code: 'sr-cyrl'}, // TODO translate
    { name: 'سنڌي', code: 'sd'},
    { name: 'සිංහල', code: 'si'},
    { name: 'siSwati', code: 'ss'},
    { name: 'Slovenčina', code: 'sk'},
    { name: 'Slovenščina', code: 'sl'},
    { name: 'Gàidhlig', code: 'gd'},
    { name: 'Español', code: 'es'},
    { name: 'Español (República Dominicana)', code: 'es-do'},
    { name: 'Español (México)', code: 'es-mx'},
    { name: 'Español (Estados Unidos)', code: 'es-us'},
    { name: 'Kiswahili', code: 'sw'},
    { name: 'Svenska', code: 'sv'},
    { name: 'Tagalog (Philippines)', code: 'tl-ph'}, // TODO translate
    { name: 'Talossan', code: 'tzl'}, // TODO translate
    { name: 'Тоҷикӣ', code: 'tg'},
    { name: 'தமிழ்', code: 'ta'},
    { name: 'తెలుగు', code: 'te'},
    { name: 'Lia-Tetun', code: 'tet'},
    { name: 'ภาษาไทย', code: 'th'},
    { name: 'Tibetan', code: 'bo'}, // TODO translate
    { name: 'Türkmençe', code: 'tk'},
    { name: 'Türkçe', code: 'tr'},
    { name: 'Українська', code: 'uk'},
    { name: 'اُردُو', code: 'ur'},
    { name: 'ئۇيغۇر تىلى', code: 'ug-cn'},
    { name: 'Ўзбек', code: 'uz'},
    { name: 'Uzbek (Latin)', code: 'uz-latn'}, // TODO translate
    { name: 'tiếng Việt', code: 'vi'},
    { name: 'Cymraeg', code: 'cy'},
    { name: 'Èdè Yorùbá', code: 'yo-ng'},

];

    
