import { OptionsPaneItemDescriptor } from '../OptionsPaneItemDescriptor';
import { OptionsPaneCategoryDescriptor } from '../OptionsPaneCategoryDescriptor';

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
    //const allOptionsCount = getAllOptionsCount(allOptions);
    //const hits = getSearchHits(allOptions, searchRegex);

    const optionHits = this.collectHits(this.categories, searchRegex, []);
    const sortedHits = optionHits.sort(compareHit).map((x) => x.item);

    return {
      optionHits: sortedHits,
      overrideHits: [],
      totalCount: this.getAllOptionsCount(this.categories),
    };
  }

  private collectHits(categories: OptionsPaneCategoryDescriptor[], searchRegex: RegExp, hits: SearchHit[]) {
    for (const category of categories) {
      const categoryNameMatch = searchRegex.test(category.props.title);

      for (const item of category.items) {
        if (searchRegex.test(item.props.title)) {
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
    var total = 0;

    for (const category of categories) {
      total += category.items.length;

      if (category.categories.length > 0) {
        total += this.getAllOptionsCount(category.categories);
      }
    }

    return total;
  }
}

interface SearchHit {
  item: OptionsPaneItemDescriptor;
  rank: number;
}

function compareHit(left: SearchHit, right: SearchHit) {
  return left.rank - right.rank;
}
