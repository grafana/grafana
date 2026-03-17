declare module 'clsx' {
  type ClassValue = string;
  function clsx(...inputs: ClassValue[]): string;
  export = clsx;
}
