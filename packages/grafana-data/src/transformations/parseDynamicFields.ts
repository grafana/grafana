import { isArray as _isArray } from 'lodash';
import moment from 'moment-timezone';
import { DynamicFieldsConstant } from './transformers/dynamicFieldsFormatter';

type DynamicFieldsOptions = {
  platformURL?: string;
  timeZone?: string;
};

type DynamicFieldParseType = 'Map' | 'Record' | 'Text' | 'None';
type DynamicFieldType = Map<string, any> | Record<string, any> | string;

type DynamicFieldsResult = {
  type: DynamicFieldParseType;
  data: DynamicFieldType;
  raw: string;
};

/**
 * Description: Takes a string as input, checks its case types, and calls "generateKeyValue" function to create key-value pairs.
 * @param: String and timezone
 * @Arguments type: BWF string + JSON data
 */
export function parseDynamicField(rawText: string, ctrl: DynamicFieldsOptions = {}): DynamicFieldsResult {
  let result = new Map();

  if (typeof rawText === 'string') {
    const parts = rawText.split('##');

    const fieldsType = parts[0];

    if (fieldsType === 'CASE' || fieldsType === 'TASK') {
      return {
        raw: rawText,
        type: 'Map',
        data: generateKeyValue(parts, 'Audit_Trail_Report', ctrl?.platformURL),
      };
    }

    if (fieldsType === 'FORMAT_DYNAMIC_DATA') {
      return {
        raw: rawText,
        type: 'Map',

        data: generateKeyValue(parts, 'Summary_Report'),
      };
    }

    if (fieldsType === 'SOCIAL') {
      const result = generateKeyValue(parts, 'Social_activity');
      return {
        raw: rawText,
        type: typeof result === 'string' ? 'Text' : 'Map',
        data: result,
      };
    }

    const data = parseJSON(rawText);
    if (data) {
      return {
        raw: rawText,
        data: data,
        type: 'Record',
      };
    }
  }

  result.set('data', rawText);
  return {
    raw: rawText,
    data: result,
    type: 'None',
  };
}

/**
 * 
 * Description: Takes a string array as input, pass each string record to "getQuestionReport" function to generate map
 * @param rawText
 * @param requestMap 
 */
export function parseDWPDynamicField(rawText: string[], requestMap: Map<string, string>): void {
  let result = new Map<string, string>();
  rawText.forEach((v) => {
    const parts = v.split('##');
    const filteredReq = parts.filter((p: string | string[]) => p.indexOf(DynamicFieldsConstant.reqId) == 0);
    let request = filteredReq.length > 0 ? filteredReq[0] : '';
    if (request === '') {
      result.set('Error', 'Invalid JSON Data Format');
    }
    getQuestionReport(parts, result);
    let requestId = request.replace(DynamicFieldsConstant.reqIdColon, '');    
    requestMap.set(requestId, JSON.stringify(Object.fromEntries(result)));
  });
}

/**
 * Description: Splits data according to case type parameters and passes it to the "parseDataType" function to create key-value pairs.
 * @param: String, String amd platformUrl
 * @Arguments type: data: received string format, case_type: string containing case name.
 */
function generateKeyValue(data: string[], case_type: string, platformUrl?: string): Map<string, string> | string {
  let result = new Map();

  if (case_type === 'Summary_Report') {
    result = getSummaryReport(data);
  } else if (case_type === 'Audit_Trail_Report') {
    result = getAuditTrailReport(data, platformUrl);
  } else if (case_type === 'Social_activity') {
    let post_type = '';
    let post_details = null;
    let author = '';

    data.forEach((item: any) => {
      if (item.indexOf('Post Type:') === 0) {
        post_type = item.split(':')[1].trim();
      } else if (item.indexOf('Post Details:') === 0) {
        post_details = item.replace('Post Details: ', '');
      } else if (item.indexOf('Author:') === 0) {
        author = item.split(':')[1].trim();
      }
    });

    return generateSocialActivity(post_type, post_details, author);
  }

  return result;
}


function generateSocialActivity(post_type: any, post_details: any, author: any): string {
  const parsedDetails: any = parseJSON(post_details);
  if (parsedDetails) {
    switch (post_type) {
      case 'system#email':
        const sentTo = parsedDetails?.entities?.messageTo?.[0]?.fullName?.replace(/^"|"$/g, '') ?? 'Unknown';
        return `Email sent to ${sentTo}`;
      case 'system#Views':
      case 'system#views':
        return `${author} has viewed the case ${parsedDetails.viewCount} times`;
      case 'system#pinvalidation':
        return `PIN validation ${parsedDetails.validationStatus}`;
      case 'comment#user':
        return parsedDetails.text || '';
      case 'system#approval':
        return parsedDetails.entities.status === '1'
          ? `Approval granted for ${parsedDetails.entities.approvalID}`
          : `Approval rejected for ${parsedDetails.entities.approvalID}`;
      case 'system#association':
        return `Relationship ${parsedDetails.operation === 'ADD' ? 'added for' : 'removed for'} ${parsedDetails.type === 'Case' ? parsedDetails.displayID : parsedDetails.fullName}`;
      default:
        return 'Invalid Post Type';
    }
  }
  return 'Invalid Data';
}

function getSummaryReport(data: any) {
  let result = new Map();
  data.forEach((item: any, index: number) => {
    if (item.indexOf('Dynamic Data:') === 0) {
      const dynData = item.replace('Dynamic Data:', '');
      const dynDataDef = data[index + 1]?.replace('Dynamic Data Definition:', '');

      const parsedDynData = parseJSON(dynData) as any;
      const parsedDynDataDef = parseJSON(dynDataDef) as any[];
      if (parsedDynData && parsedDynDataDef) {
        for (let key in parsedDynData) {
          parsedDynDataDef.forEach((def: any) => {
            if (key === def.name && !def.hidden && !def.hasOwnProperty('attributes')) {
              result.set(key, parseDataType(def.dataType, parsedDynData[key]));
            } else if (key === def.name && def.hasOwnProperty('attributes')) {
              result.set(key, parseDataType('attributes', parsedDynData[key], def.attributes));
            }
          });
        }
      } else {
        result.set('Error', 'Invalid JSON Data Format');
      }
    }
  });
  return result;
}

function getQuestionReport(data: any, result: Map<string, string>) {
  let questionId: any = undefined;
  let requestId: any = undefined;
  let answer: any = undefined;
  let answerJson: any = undefined;
  let displayAsJson: any = undefined;
  let parseQuestionData: any = undefined;
  data.forEach((item: any, index: number) => {
    if (item.indexOf('RQID:') === 0) {
      requestId = item.replace('RQID:', '');
      if(result.get('Request Id') && result.get('Request Id')!==requestId){
        result.clear();
      }
      result.set('Request Id', requestId);
    }
    if (item.indexOf('QID:') === 0) {
      questionId = item.replace('QID:', '');
    }
    if (item.indexOf('AnswerAsJson:') === 0) {
      answerJson = item.replace('AnswerAsJson:', '');
      if (parseJSON(answerJson)) {
        answer = JSON.parse(answerJson).join(',');
      }
    }
    if (item.indexOf('DisplayValueOfAnswersAsJson:') === 0) {
      displayAsJson = item.replace('DisplayValueOfAnswersAsJson:', '');
    }
    if (item.indexOf('Question JSON:') === 0) {
      let dynData = item.replace('Question JSON:', '');
      if (parseJSON(dynData)) {
        parseQuestionData = parseJSON(dynData);
        if (parseQuestionData !== undefined && answer !== undefined && displayAsJson !== undefined) {
          let matchingQuestion: any = undefined;
          for (let i = 0; i < parseQuestionData.pages.length; i++) {
            matchingQuestion = parseQuestionData.pages[i].pageItems.filter((record: { id: any; }) => record.id === questionId);
            if (matchingQuestion.length > 0) {
              break;
            }
          }
          if (matchingQuestion.length > 0) {
            if (matchingQuestion[0].type === 'PasswordField' || matchingQuestion[0].confidential) {
              result.set(matchingQuestion[0].label, '');
            } else if (matchingQuestion[0].type === 'Attachment') {
              result.set(matchingQuestion[0].label, 'Attachment Here');
            } else if (
              matchingQuestion[0].type === 'MultiSelectDataTable' ||
              matchingQuestion[0].type === 'DataTable') {
              if (parseJSON(displayAsJson)) {
                displayAsJson = displayAsJson.replaceAll(',', ', ');
                result.set(matchingQuestion[0].label, JSON.parse(displayAsJson).join('\n'));
              } else {
                result.set(matchingQuestion[0].label, displayAsJson);
              }
            } else if (
              matchingQuestion[0].type === 'MultiSelectDropdown' ||
              matchingQuestion[0].type === 'Checkbox' ||
              matchingQuestion[0].type === 'RadioButtons' ||
              matchingQuestion[0].type === 'YesNo') {
              if (parseJSON(displayAsJson)) {
                result.set(matchingQuestion[0].label, JSON.parse(displayAsJson).join(','));
              } else {
                result.set(matchingQuestion[0].label, displayAsJson);
              }
            } else {
              result.set(matchingQuestion[0].label, answer);
            }
          }
          else {
            result.set('Error', 'Invalid JSON Data Format');
          }
        }
      }
    }
  });
  return result;
}

function getAuditTrailReport(data: string[], platformUrl: any) {
  let result = new Map<string, any>();
  let action = '';

  data.forEach((item: any) => {
    if (item.indexOf('Action:') === 0) {
      action = item.split(':')[1].trim();
    }
  });

  data.forEach((item: any) => {
    if (item.indexOf('Fields Changed:') === 0) {
      const fieldsChanged = item.split(';');
      fieldsChanged.forEach((field: any) => {
        if (field) {
          const fieldKey = checkAlternateKey(field);
          if (fieldKey === 'Confidential Data Audit Info') {
            result.set('Confidential Data', 'Confidential Case Data was modified.');
          } else {
            data.forEach((dataItem: any) => {
              if (fieldKey === 'Dynamic Data Audit Info') {
                if (dataItem.indexOf(fieldKey + ':') === 0) {
                  let parse_json = null;
                  let temp_parse_json = dataItem.replace(fieldKey + ':', '');
                  if (parseJSON(temp_parse_json)) {
                    parse_json = JSON.parse(temp_parse_json);
                    for (let key in parse_json.quetsionAnswerMap) {
                      if (parse_json.quetsionAnswerMap[key].confidential === false) {
                        let dataVal =
                          parse_json.quetsionAnswerMap[key].listType?.toUpperCase() === 'DYNAMIC'
                            ? parse_json.quetsionAnswerMap[key].displayAnswer
                            : parse_json.quetsionAnswerMap[key].answer;
                        let parse_value = parseDataType(parse_json.quetsionAnswerMap[key].dataType, dataVal, undefined);
                        result.set(parse_json.quetsionAnswerMap[key].questionDescription, parse_value);
                      }
                    }
                  } else {
                    let key_values = dataItem.split(':');
                    if (!(key_values[1].trim() === '' && action === '4')) {
                      result.set('Dynamic Data Audit Info', '');
                    }
                  }
                }
              } else {
                if (dataItem.indexOf(fieldKey + ':') === 0) {
                  let key, value;
                  if (dataItem.indexOf('<img') < 0) {
                    [key, value] = dataItem.split(':');
                  } else {
                    const keyIndex = dataItem.indexOf(':');
                    const imgUrl = dataItem.slice(keyIndex + 1).replace('/api', platformUrl);
                    [key, value] = [dataItem.slice(0, keyIndex), imgUrl];
                  }
                  if (!(value.trim() === '' && action === '4')) {
                    result.set(key, value);
                  }
                }
              }
            });
          }
        }
      });
    }
  });

  return result;
}

/**
 * Description: Converts value according to its data types and returns the corresponding result.
 *
 * @param: String, any, JSON (optional)
 * @Arguments type:
 *    dataType: Text, Number, Time, Boolean, date, Date Time, attachment, list, case_type.
 *    value: Value based on the data type.
 *    data_def: JSON data type for "Dynamic Group"
 */
export const parseDataType = (dataType: string, value: any, data_def: any[] = []): string | Map<string, any> => {
  switch (dataType) {
    case 'LIST':
    case 'TEXT':
      return value;

    case 'NUMBER':
      if (value === null || value === void 0) {
        return '-';
      }
      if (isNaN(value) || _isArray(value)) {
        return value;
      }
      return value.includes('.') ? Number(value).toFixed(2) : value;

    case 'TIME':
      const [hoursStr, minutes, seconds] = value.split(':');
      if (!hoursStr || !minutes || !seconds) {
        return 'Invalid Time';
      }
      const hours = hoursStr % 12 || 12;
      const ampm = hoursStr >= 12 ? 'PM' : 'AM';
      return `${hours}:${minutes.padStart(2, '0')}:${seconds} ${ampm}`;

    case 'DATE_TIME':
    case 'date_time':
      return moment.unix(Number(value)).tz(moment.tz.guess()).format('D-MMMM-YYYY h:mm:ss a');

    case 'DATE':
      return moment.unix(Number(value)).tz(moment.tz.guess()).format('D-MMMM-YYYY');

    case 'BOOLEAN':
      return value === '1' ? 'Yes' : 'No';

    case 'ATTACHMENT':
      return 'Attachment Present';

    case 'attributes':
      let attributesResult = new Map();
      for (let key in value) {
        data_def?.forEach((def: any) => {
          if (key === def.name && !def.hidden && !def.confidential) {
            attributesResult.set(key, parseDataType(def.dataType, value[key]));
          }
        });
      }
      return attributesResult;

    default:
      return value;
  }
};

/**
 * Maps specific keys to alternate names. If the key is not in the mapping, returns the original key.
 *
 * @param {any} key - The key to be checked and mapped.
 * @returns {string} - The mapped key if found, otherwise the original key.
 *
 * @example
 * const result = checkAlternateKey('Ticket Status GUID');
 * console.log(result); // Output: 'Status'
 *
 * @example
 * const result = checkAlternateKey('Unknown Key');
 * console.log(result); // Output: 'Unknown Key'
 */
export const checkAlternateKey = (key: any): string => {
  const keyMapping: Record<string, string> = {
    'Ticket Status GUID': 'Status',
    'Assignee GUID': 'Assignee',
    SITE_ID: 'Site',
    'ASSIGNED COMPANY_ID': 'Assigned Company',
    LABEL_ID: 'Label',
  };
  return keyMapping[key] || key;
};

/**
 * Checks if a string is a valid JSON format.
 *
 * @param {string} data - The string to check.
 * @returns {boolean} `true` if the string is valid JSON, `false` otherwise.
 */
export const parseJSON = (value: string): Object | false => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return false;
  }
};
