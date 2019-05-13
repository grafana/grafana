import { OptionsGroupUIBuilder } from './OptionsUIBuilder';
import { SingleStatBaseOptions } from '../SingleStatShared/SingleStatBaseOptions';
import { BooleanOption } from './BooleanOption';
import { IntegerOption } from './NumericInputOption';
interface GaugeOptions extends SingleStatBaseOptions {
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
}

describe('OptionsUIBuilder', () => {
  it('allows group as root', () => {
    const builder = new OptionsGroupUIBuilder<GaugeOptions>();

    const schema = builder
      .addGroup({})
      .addBooleanEditor('showThresholdLabels')
      .addBooleanEditor('showThresholdMarkers')
      .addNestedOptionsGroup('fieldOptions', {})
      .addThresholdsEditor('thresholds')
      .addNestedOptionsGroup('override', {})
      .addOptionEditor('max', {
        component: IntegerOption,
        properties: { label: 'whatever' },
      })
      .endGroup()
      .endGroup()
      .addGroup({})
      // .addOptionEditor('orientation', {
      //   component: BooleanOption as any,
      // })
      .endGroup()
      .getUIModel();
    debugger;
    console.log(schema);
  });
});
