import { OptionsGroupUIBuilder } from './OptionsUIBuilder';
import { SingleStatBaseOptions } from '../SingleStatShared/SingleStatBaseOptions';
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
            .addNestedOptionsGroup('fieldOptions', {})
              .addThresholdsEditor('thresholds')
            .endGroup() // How to return parent groupd ctx type here?
          .endGroup()
          .addGroup({})
            // We are in the context of fieldOptions option still... unfortunately
            .addFieldPropertiesEditor('')
          .endGroup()
        .getUIModel()

      console.log(schema);
    });
  });
});
