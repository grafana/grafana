import { monaco } from '@monaco-editor/react';

let initalized = false;

export function checkSetup() {
  if (initalized) {
    return;
  }

  // Use local monaco values
  monaco.config({ paths: { vs: '/public/build/monaco/min/vs' } });

  // you can configure the locales
  // monaco.config({ 'vs/nls': { availableLanguages: { '*': 'en' } } });

  console.log('TODO SETUP!', monaco);
  initalized = true;
}
