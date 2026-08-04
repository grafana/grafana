import { PageObject, type PageObjectArgs } from '../PageObject';

import { ConditionalRenderingOptions } from './shared/ConditionalRenderingOptions';
import { RepeatOptions } from './shared/RepeatOptions';

// The "Tab options" pane in the sidebar — currently just composes the
// shared repeat and conditional rendering option groups
export class TabOptions extends PageObject {
  public conditionalRenderingOptions: ConditionalRenderingOptions;
  public repeatOptions: RepeatOptions;

  constructor(args: PageObjectArgs) {
    super(args);
    this.conditionalRenderingOptions = new ConditionalRenderingOptions(args);
    this.repeatOptions = new RepeatOptions(args);
  }
}
