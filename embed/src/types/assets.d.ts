/** Vite's ?inline query returns a stylesheet's text rather than injecting it. */
declare module '*?inline' {
  const css: string;
  export default css;
}
