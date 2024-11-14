import { OptionsPaneCategoryDescriptor } from '../OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from '../OptionsPaneItemDescriptor';

export function getRecentOptions(allOptions: OptionsPaneCategoryDescriptor[]) {
  const popularOptions: OptionsPaneItemDescriptor[] = [];

  for (const category of allOptions) {
    for (const item of category.items) {
      if (item.props.title === 'Unit') {
        item.props.popularRank = 2;
      }
      if (item.props.title === 'Min') {
        item.props.popularRank = 3;
      }
      if (item.props.title === 'Max') {
        item.props.popularRank = 4;
      }
      if (item.props.title === 'Display name') {
        item.props.popularRank = 5;
      }

      if (item.props.popularRank) {
        popularOptions.push(item);
      }
    }
  }

  return popularOptions.sort((left, right) => left.props.popularRank! - right.props.popularRank!);
}
