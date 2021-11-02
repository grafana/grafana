// Code based on Material UI
// The MIT License (MIT)
// Copyright (c) 2014 Call-Em-All
// Follow https://material.google.com/motion/duration-easing.html#duration-easing-natural-easing-curves
// to learn the context in which each easing should be used.
var easing = {
    // This is the most common easing curve.
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    // Objects enter the screen at full velocity from off-screen and
    // slowly decelerate to a resting point.
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    // Objects leave the screen at full velocity. They do not decelerate when off-screen.
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    // The sharp curve is used by objects that may return to the screen at any time.
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
};
// Follow https://material.io/guidelines/motion/duration-easing.html#duration-easing-common-durations
// to learn when use what timing
var duration = {
    shortest: 150,
    shorter: 200,
    short: 250,
    // most basic recommended timing
    standard: 300,
    // this is to be used in complex animations
    complex: 375,
    // recommended when something is entering screen
    enteringScreen: 225,
    // recommended when something is leaving screen
    leavingScreen: 195,
};
/** @alpha */
export function create(props, options) {
    if (props === void 0) { props = ['all']; }
    if (options === void 0) { options = {}; }
    var _a = options.duration, durationOption = _a === void 0 ? duration.standard : _a, _b = options.easing, easingOption = _b === void 0 ? easing.easeInOut : _b, _c = options.delay, delay = _c === void 0 ? 0 : _c;
    return (Array.isArray(props) ? props : [props])
        .map(function (animatedProp) {
        return animatedProp + " " + (typeof durationOption === 'string' ? durationOption : formatMs(durationOption)) + " " + easingOption + " " + (typeof delay === 'string' ? delay : formatMs(delay));
    })
        .join(',');
}
export function getAutoHeightDuration(height) {
    if (!height) {
        return 0;
    }
    var constant = height / 36;
    // https://www.wolframalpha.com/input/?i=(4+%2B+15+*+(x+%2F+36+)+**+0.25+%2B+(x+%2F+36)+%2F+5)+*+10
    return Math.round((4 + 15 * Math.pow(constant, 0.25) + constant / 5) * 10);
}
function formatMs(milliseconds) {
    return Math.round(milliseconds) + "ms";
}
/** @internal */
export function createTransitions() {
    return {
        create: create,
        duration: duration,
        easing: easing,
        getAutoHeightDuration: getAutoHeightDuration,
    };
}
//# sourceMappingURL=createTransitions.js.map