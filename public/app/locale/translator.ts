import { vocabs } from "./fa-IR";

interface Vocabs {
    [key: string]: string;
}

export function Translator(vocabs: Vocabs) {

    const dictionary = Object.entries(vocabs).reduce((dic, [key, value]) => ({
        ...dic,
        [key.toLowerCase()]: value,
    }), {} as Vocabs);

    return function translate(key = "") {
        const term = key.toLowerCase();
        return dictionary[term] || term;
    };
}

export const translate = Translator(vocabs);
