import { capitalizeText } from 'app/percona/shared/helpers/capitalizeText';

export const parseDetail = (detail: string) => {
  if (!detail.includes('- Error: ')) {
    return {
      name: '',
      error: detail,
    };
  }

  const [name, error] = detail.split('- Error: ');

  return {
    name: name.replace('API key name: ', ''),
    error: capitalizeText(error),
  };
};
