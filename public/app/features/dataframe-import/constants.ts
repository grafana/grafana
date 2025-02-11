import { Accept } from 'react-dropzone';

export const acceptedFiles: Accept = {
  'text/plain': ['.csv', '.txt'],
  'application/json': ['.json'],
};

//This should probably set from grafana conf
export const maxFileSize = 500000;
