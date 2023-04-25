import { ChangeEvent, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type HtmlInputAttrs<T, IA = InputHTMLAttributes<T>> = {
  [P in keyof IA]?: IA[P];
};

type HtmlTextareaAttrs<T, TA = TextareaHTMLAttributes<T>> = {
  [P in keyof TA]?: TA[P];
};

export interface FieldInputAttrs extends Omit<HtmlInputAttrs<HTMLInputElement>, 'name'> {
  checked?: boolean;
  multiple?: boolean;
}

export interface FieldTextareaAttrs extends Omit<HtmlTextareaAttrs<HTMLTextAreaElement>, 'name'> {
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}
