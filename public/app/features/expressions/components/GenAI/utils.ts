/**
 * Parses AI-generated suggestions that contain mixed content (text and code blocks).
 *
 * AI responses often come in markdown format with explanatory text and code blocks
 * delimited by triple backticks (```). This function separates and structures that
 * content for proper rendering in the UI.
 *
 * @param suggestion - Raw AI suggestion string potentially containing markdown code blocks
 * @returns Array of parsed parts, each with:
 *   - type: 'text' for explanatory content, 'code' for SQL queries
 *   - content: The actual text or code content
 *   - language: For code blocks, the detected language (defaults to 'sql', normalized to 'mysql')
 *
 * Example input: "Here's a query:\n```sql\nSELECT * FROM A\n```\nThis joins data."
 * Example output: [
 *   { type: 'text', content: "Here's a query:" },
 *   { type: 'code', content: 'SELECT * FROM A', language: 'mysql' },
 *   { type: 'text', content: 'This joins data.' }
 * ]
 */
export const parseSuggestion = (suggestion: string) => {
  if (!suggestion) {
    return [];
  }
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];

  // Split by triple backticks to find code blocks
  const segments = suggestion.split(/```/);

  segments.forEach((segment, index) => {
    if (index % 2 === 0) {
      // Even indices are text (outside code blocks)
      if (segment.trim()) {
        parts.push({ type: 'text', content: segment.trim() });
      }
    } else {
      // Odd indices are code blocks
      const lines = segment.split('\n');
      let language = 'sql'; // default language
      let codeContent = segment;

      // Check if first line specifies a language
      if (lines[0] && lines[0].trim() && !lines[0].includes(' ')) {
        language = lines[0].trim().toLowerCase();
        codeContent = lines.slice(1).join('\n');
      }

      // Remove trailing newlines
      codeContent = codeContent.replace(/\n+$/, '');

      if (codeContent.trim()) {
        const finalLanguage = language === 'mysql' ? 'mysql' : language === 'sql' ? 'mysql' : language;
        parts.push({
          type: 'code',
          content: codeContent.trim(),
          language: finalLanguage,
        });
      }
    }
  });

  return parts;
};
