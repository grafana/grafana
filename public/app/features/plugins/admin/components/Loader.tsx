import { Box, LoadingPlaceholder } from '@grafana/ui';

export interface Props {
  text?: string;
}

export const Loader = ({ text = 'Loading...' }: Props) => {
  return (
    <Box display="flex" alignItems="center" direction="column" justifyContent="center" paddingTop={10}>
      <LoadingPlaceholder text={text} />
    </Box>
  );
};
