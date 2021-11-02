function roundMsToMin(milliseconds) {
    return roundSecToMin(milliseconds / 1000);
}
function roundSecToMin(seconds) {
    return Math.floor(seconds / 60);
}
export function shouldRefreshLabels(range, prevRange) {
    if (range && prevRange) {
        var sameMinuteFrom = roundMsToMin(range.from.valueOf()) === roundMsToMin(prevRange.from.valueOf());
        var sameMinuteTo = roundMsToMin(range.to.valueOf()) === roundMsToMin(prevRange.to.valueOf());
        // If both are same, don't need to refresh
        return !(sameMinuteFrom && sameMinuteTo);
    }
    return false;
}
//# sourceMappingURL=language_utils.js.map