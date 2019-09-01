import { vocabs } from "./fa-IR";

export const Translator = (vocabularies: { [key: string]: string }) => {
    const dictionary = Object.entries(vocabularies).map(([key, value]) => ({ [key.toLowerCase()]: value }));
    return (key = "") => {
        const term = key.toLowerCase();
        return dictionary[term] || term;
    };
};

export const translate = Translator(vocabs);
