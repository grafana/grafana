import { monaco } from '@monaco-editor/react';

let initalized = false;

export function checkSetup() {
  if (initalized) {
    return;
  }

  console.log('Init Monaco!');

  // Use local monaco values
  monaco.config({ paths: { vs: 'public/lib/monaco/min/vs' } });

  console.log('TODO SETUP!', monaco);
  initalized = true;
}
