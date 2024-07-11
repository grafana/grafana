import { Box, LoadingPlaceholder } from '@grafana/ui';

interface Props {
  pageName?: string;
}

const PageLoader = ({ pageName = '' }: Props) => {
  const loadingText = `Loading ${pageName}...`;
  return (
    <Box display="flex" alignItems="center" direction="column" justifyContent="center" paddingTop={10}>
      <LoadingPlaceholder text={loadingText} />
    </Box>
  );
};

export default PageLoader;
