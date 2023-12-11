import { llms } from '@grafana/experimental';

import { DB, SQLQuery } from '../../types';

export async function requestAI(datasource: string, db: DB, prompt: string, selectedTables: any[]) {
  const tables = [];

  for (const item of selectedTables) {
    const columns = await db.fields({ table: item.value } as SQLQuery);
    tables.push({ tableName: item.value, columns: columns });
  }

  const response = await llms.openai.chatCompletions({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'system', content: getSystemPrompt(datasource, prompt, JSON.stringify(tables)) }],
    temperature: 0,
  });

  return response.choices[0].message.content;
}

export function getSystemPrompt(datasource: string, prompt: string, tables: string) {
  return `You are an SQL expert assistant.
You will be given a prompt along with table and column names.
You are to take the prompt and return a suggested query based on all provided data.
Show only the suggested SQL Query.

The users prompt is
\`\`\`
${prompt}
\`\`\`

The database tables and columns are as follows
\`\`\`
${tables}
\`\`\`

Rules:
- You should only response with a single "valid" SQL statement.
- All queries should end with a semi-colon.
- The database used is ${datasource}, Make sure to use the correct syntax.
- Do NOT invent table or column names, you must use only the data provided.
- The year date is ${new Date()} make sure to keep this in mind when writing any queries that use dates.

Answer:
\`\`\``;
}
