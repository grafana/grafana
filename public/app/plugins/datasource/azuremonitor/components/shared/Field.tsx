import { EditorField } from '@grafana/plugin-ui';
import { InlineField } from '@grafana/ui';
import { Props as InlineFieldProps } from '@grafana/ui/src/components/Forms/InlineField';

interface Props extends InlineFieldProps {
  label: string;
  inlineField?: boolean;
  labelWidth?: number;
}

const DEFAULT_LABEL_WIDTH = 18;

export const Field = (props: Props) => {
  const { labelWidth, inlineField, ...remainingProps } = props;

  if (!inlineField) {
    return <EditorField width={labelWidth || DEFAULT_LABEL_WIDTH} {...remainingProps} />;
  } else {
    return <InlineField labelWidth={labelWidth || DEFAULT_LABEL_WIDTH} {...remainingProps} />;
  }
};
