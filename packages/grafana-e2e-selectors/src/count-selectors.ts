// npx tsx ./packages/grafana-e2e-selectors/src/count-selectors.ts

// Script to count selectors from versionedComponents and versionedPages
import { versionedComponents } from './selectors/components';
import { versionedPages } from './selectors/pages';

// Function to count selectors recursively
function countSelectors(obj: any, depth = 0): number {
  let count = 0;

  for (const key in obj) {
    const value = obj[key];

    if (value === null || value === undefined) {
      continue;
    }

    // If the value is an object, recurse into it
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Check if this object contains version keys (like '10.2.3', '9.5.0', etc.)
      const keys = Object.keys(value);
      const hasVersionKeys = keys.some((k) => /^\d+\.\d+\.\d+$/.test(k) || k.includes('MIN_GRAFANA_VERSION'));

      if (hasVersionKeys) {
        // This is a selector definition with versions
        count++;
      } else {
        // Keep recursing
        count += countSelectors(value, depth + 1);
      }
    }
  }

  return count;
}

// Count selectors in both objects
const componentsCount = countSelectors(versionedComponents);
const pagesCount = countSelectors(versionedPages);
const totalCount = componentsCount + pagesCount;

console.log('\n=== Selector Count Summary ===');
console.log(`Source files:`);
console.log(`  - src/selectors/components.ts`);
console.log(`  - src/selectors/pages.ts`);
console.log();
console.log(`versionedComponents: ${componentsCount} selectors`);
console.log(`versionedPages: ${pagesCount} selectors`);
console.log(`Total: ${totalCount} selectors`);
console.log('============================\n');
