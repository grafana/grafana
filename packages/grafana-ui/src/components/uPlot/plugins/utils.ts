const CONTENT_LINES = `
Lorem ipsum dolor sit amet, consectetur
sed do eiusmod tempor incididunt ut labore et dolore magna
aliqua. Ut enim ad minim veniam,
ullamco laboris nisi ut aliquip ex ea commodo
Duis aute irure dolor in reprehenderit in
esse cillum dolore
occaecat cupidatat non
deserunt mollit anim id est laborum.
`
  .trim()
  .split('\n');

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomContent() {
  let shuffled = CONTENT_LINES.slice().sort(() => 0.5 - Math.random());
  return shuffled.slice(0, getRandomInt(1, shuffled.length)).join('\n');
}
