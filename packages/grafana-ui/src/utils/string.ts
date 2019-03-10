export function stringToJsRegex(str: string): RegExp {
  if (str[0] !== '/') {
    return new RegExp('^' + str + '$');
  }

  const match = str.match(new RegExp('^/(.*?)/(g?i?m?y?)$'));

  if (!match) {
    throw new Error(`'${str}' is not a valid regular expression.`);
  }

  return new RegExp(match[1], match[2]);
}
