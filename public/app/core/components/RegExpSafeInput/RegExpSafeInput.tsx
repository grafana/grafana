import React, { forwardRef } from 'react';

const specialChars = ['(', '[', '{', '}', ']', ')', '|', '*', '+', '-', '.', '?', '<', '>', '#', '&', '^', '$'];

export const escapeStringForRegex = (value: string) => {
  if (!value) {
    return value;
  }

  const newValue = specialChars.reduce(
    (escaped, currentChar) => escaped.replace(currentChar, '\\' + currentChar),
    value
  );

  return newValue;
};

export const unEscapeStringFromRegex = (value: string) => {
  if (!value) {
    return value;
  }

  const newValue = specialChars.reduce(
    (escaped, currentChar) => escaped.replace('\\' + currentChar, currentChar),
    value
  );

  return newValue;
};

export interface Props {
  value: string | undefined;
  placeholder?: string;
  className?: string;
  onChange: (value: string) => void;
}

export const RegExpSafeInput = forwardRef<HTMLInputElement, Props>((props, ref) => (
  <input
    ref={ref}
    type="text"
    className={props.className}
    value={unEscapeStringFromRegex(props.value)}
    onChange={event => props.onChange(escapeStringForRegex(event.target.value))}
    placeholder={props.placeholder ? props.placeholder : null}
  />
));
