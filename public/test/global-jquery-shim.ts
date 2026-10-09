import $ from 'jquery';

const global: typeof window & { $?: typeof $; jQuery?: typeof $ } = window;
global.$ = global.jQuery = $;
