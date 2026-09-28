// jquery must evaluate before the flot plugins: every file in public/vendor/flot ends
// `})(jQuery)`, reading the global that expose-loader sets when the jquery module evaluates.
// Keeping them in one module is what guarantees that order.
import jquery from 'jquery';
import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.stack';
import 'vendor/flot/jquery.flot.stackpercent';
import 'vendor/flot/jquery.flot.fillbelow';
import 'vendor/flot/jquery.flot.crosshair';
import 'vendor/flot/jquery.flot.dashes';
import 'vendor/flot/jquery.flot.gauge';

// Not a barrel: this is the one jquery instance the flot plugins registered onto.
// eslint-disable-next-line no-barrel-files/no-barrel-files
export default jquery;
