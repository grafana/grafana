// Returns the factors of a number
// Example getFactors(12) -> [1, 2, 3, 4, 6, 12]
export default function getFactors(num) {
    return Array.from(new Array(num + 1), function (_, i) { return i; }).filter(function (i) { return num % i === 0; });
}
//# sourceMappingURL=factors.js.map