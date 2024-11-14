// Returns the factors of a number
// Example getFactors(12) -> [1, 2, 3, 4, 6, 12]
export default function getFactors(num: number): number[] {
  return Array.from(new Array(num + 1), (_, i) => i).filter((i) => num % i === 0);
}
