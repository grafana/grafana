import { OptionsPaneCategoryDescriptor } from '../OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from '../OptionsPaneItemDescriptor';

export interface OptionSearchResults {
  optionHits: OptionsPaneItemDescriptor[];
  overrideHits: OptionsPaneCategoryDescriptor[];
  totalCount: number;
}

export class OptionSearchEngine {
  constructor(
    private categories: OptionsPaneCategoryDescriptor[],
    private overrides: OptionsPaneCategoryDescriptor[]
  ) {}

  search(query: string): OptionSearchResults {
    const searchRegex = new RegExp(query, 'i');

    const optionHits = this.collectHits(this.categories, searchRegex, []);
    const sortedHits = optionHits.sort(compareHit).map((x) => x.item);

    const overrideHits = this.collectHits(this.overrides, searchRegex, []);
    const sortedOverridesHits = overrideHits.sort(compareHit).map((x) => x.item);

    return {
      optionHits: sortedHits,
      overrideHits: this.buildOverrideHitCategories(sortedOverridesHits),
      totalCount: this.getAllOptionsCount(this.categories),
    };
  }

  private collectHits(categories: OptionsPaneCategoryDescriptor[], searchRegex: RegExp, hits: SearchHit[]) {
    for (const category of categories) {
      const categoryNameMatch = searchRegex.test(category.props.title);

      for (const item of category.items) {
        if (searchRegex.test(item.props.title || '')) {
          hits.push({ item: item, rank: 1 });
          continue;
        }
        if (item.props.description && searchRegex.test(item.props.description)) {
          hits.push({ item: item, rank: 2 });
          continue;
        }
        if (categoryNameMatch) {
          hits.push({ item: item, rank: 3 });
        }
      }

      if (category.categories.length > 0) {
        this.collectHits(category.categories, searchRegex, hits);
      }
    }

    return hits;
  }

  getAllOptionsCount(categories: OptionsPaneCategoryDescriptor[]) {
    let total = 0;

    for (const category of categories) {
      total += category.items.length;

      if (category.categories.length > 0) {
        total += this.getAllOptionsCount(category.categories);
      }
    }

    return total;
  }

  buildOverrideHitCategories(hits: OptionsPaneItemDescriptor[]): OptionsPaneCategoryDescriptor[] {
    const categories: Record<string, OptionsPaneCategoryDescriptor> = {};

    for (const hit of hits) {
      let category = categories[hit.parent.props.title];

      if (!category) {
        category = categories[hit.parent.props.title] = new OptionsPaneCategoryDescriptor(hit.parent.props);
        // Add matcher item as that should always be shown
        category.addItem(hit.parent.items[0]);
      }

      // Prevent adding matcher twice since it's automatically added for every override
      if (category.items[0].props.title !== hit.props.title) {
        category.addItem(hit);
      }
    }

    return Object.values(categories);
  }
}

interface SearchHit {
  item: OptionsPaneItemDescriptor;
  rank: number;
}

function compareHit(left: SearchHit, right: SearchHit) {
  return left.rank - right.rank;
}
