// Vite: hacky approach to making jQuery globally available
import jQuery from 'jquery';
Object.assign(window, { $: jQuery, jQuery });

window.global ||= window;
