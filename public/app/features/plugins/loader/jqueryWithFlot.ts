// Side effects only. jquery must evaluate before the flot plugins: every file in
// public/vendor/flot ends `})(jQuery)`, reading the global that expose-loader sets when the
// jquery module evaluates. Keeping them in one module is what guarantees that order.
import 'jquery';
import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.stack';
import 'vendor/flot/jquery.flot.stackpercent';
import 'vendor/flot/jquery.flot.fillbelow';
import 'vendor/flot/jquery.flot.crosshair';
import 'vendor/flot/jquery.flot.dashes';
import 'vendor/flot/jquery.flot.gauge';
