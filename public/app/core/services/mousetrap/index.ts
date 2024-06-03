import mousetrapInstance from './Mousetrap';

// These imports must be AFTER the import of mousetrap instance so they can modify window.Mousetrap.
// We should vendor these and just add them to Mousetrap directly.
import 'mousetrap-global-bind';
import 'mousetrap/plugins/global-bind/mousetrap-global-bind';

export const mousetrap = mousetrapInstance;
