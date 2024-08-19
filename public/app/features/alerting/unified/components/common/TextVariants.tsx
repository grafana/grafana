// These are convenience components to deal with i18n shenanigans
// (see https://github.com/grafana/grafana/blob/main/contribute/internationalization.md#jsx)
// These help when we need to interpolate variables inside translated strings,
// where we need to style them differently

import { Text } from '@grafana/ui';

export const PrimaryText = ({ content }: { content: string }) => <Text color="primary">{content}</Text>;
