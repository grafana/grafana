import { OptionsGroupUIBuilder } from './OptionsUIBuilder';
import { SingleStatBaseOptions } from '../SingleStatShared/SingleStatBaseOptions';
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
      .addScopedOptions('fieldOptions', {})
      .addThresholdsEditor('thresholds')
      .addScopedOptions('override', {})
      .addOptionEditor('max', IntegerOption, {
        label: 'whatever',
      })
      .endGroup()
      .endGroup()
      .endGroup()
      .addGroup({})
      .addScopedOptions('fieldOptions', {})

      .endGroup()
      .getUIModel();
    console.log(schema);
  });
});
