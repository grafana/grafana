
# Docs AI toolkit 1.0

**Version:** 1.0 (pre-release)

The Docs AI Toolkit helps you use AI to write better documentation, faster.

It’s a starter kit packed with ready-to-use prompts and proven methods. You can either automate the toolkit directly in your code or simply copy and paste the instructions and prompts into your favorite web-based AI.

## Who is this toolkit for?

This toolkit is designed for engineers and technical writers who create documentation using our supported editors, agents, and web-based AI tools. You should be familiar with docs-as-code workflows and understand how to add context files to AI agents.

The toolkit works best if you have familiarity with:

- **Documentation workflows**: Writing and maintaining technical documentation as part of software development processes
- **AI agents**: Using GitHub Copilot, Cursor, or web-based AI tools like Gemini for content creation
- **Context management**: Providing relevant files and instructions to AI agents to improve output quality

## Set up the Docs AI toolkit

Follow the [set up documentation](./set-up.md) to set up the Docs AI toolkit for code or web agents.

{{< section withDescriptions="true" >}}


# AI tools

The Docs AI working group currently supports OpenAI and Google web agents, Visual Studio Code GitHub Copilot, and Cursor. We've also provided information on other popular tools.

For our recommendation on why you shouldn't use API-based AI tools as they're extremely expensive, refer to the [agent billing documentation](billing.md).

Choosing the right AI tool for your documentation work, whether a web-based or an "as-code" tool like Cursor, isn't about which one is universally "better." Instead, the best choice depends entirely on the specific task at hand.

Each type of tool has distinct strengths, and knowing when to use one over the other will make your workflow more efficient and your output more effective.

## Web-based AI tools

Web-based AI tools such as ChatGPT, Claude, Gemini, Google AI Studio, and others are great solutions for working on content with minimal or no setup. You can log in and use the UI to easily create distinct projects, where you can also add files, text snippets, and direct the agent to URLs when you build your prompts.

Choose a web-based AI for tasks that are primarily about writing, brainstorming, and transforming text, especially when the context lives outside your code editor.

They are an excellent fit for:

- High-level ideation and structuring when you're planning content, not yet writing it.

- Rewriting and repurposing content when you have existing text that needs to be changed for a new audience or purpose.

- Working with external sources when your source material isn't in your code repository.

For non-technical contributors when the person writing isn't a developer and doesn't work in a code editor.

Use our [`AGENTS.md`](https://github.com/grafana/docs-ai/blob/main/AGENTS.md) file with your preferred web AI agent.

The `AGENTS.md` file contains our agent instructions including role, Grafana products, and writing style guide.

There is also a [`DOCS.md`](https://github.com/grafana/docs-ai/blob/main/DOCS.md) file with all the documentation for the Docs AI toolkit.

These files make it easy to add context to your queries.

## As-code based AI tools

AI-as-code tools like GitHub Copilot and Cursor integrate directly into your code editor, giving them the full context of your repository. This allows them to help you generate code, explain complex files, and make changes across your entire project with high accuracy.

Choose an as-code AI tool when your task requires a deep understanding of your codebase and the ability to read or modify files directly.

They are an excellent fit for:

- Generating code examples when you need a code snippet that uses your project's specific libraries and conventions.

- Explaining code when you highlight a function and ask, "Explain what this code does so I can document it."

- Refactoring and updating when a change requires updating text or code across multiple files in your repository.

- Drafting content in situ when you are writing documentation directly alongside the code it describes.

Follow the [setup documentation](./set-up.md) to use the AI-as-code instructions with your project.

## Copilot

You can give GitHub Copilot in VS Code a set of custom rules using instruction files. These files teach Copilot to follow your team's specific coding style and guidelines.

To set up GitHub Copilot in VS Code, follow the [official documentation](https://code.visualstudio.com/docs/copilot/setup).

This is a good choice if you're already using Visual Studio Code and like a docs-as-code workflow. You can easily reference files for context, including images with Gemini models, and create custom instruction and prompt files. You can select from a list of different LLMs like Sonnet 4, Gemini 2.5, GPT-4.1, and o4.

For more information about Visual Studio Code GitHub Copilot, refer to the [Copilot Customization documentation](https://code.visualstudio.com/docs/copilot/).

## Cursor

Cursor supports custom instructions through Project Rules that provide persistent, reusable context for code generation and editing.

[Download](https://cursor.com/) and install Cursor.

It's also a good choice for those who like a docs-as-code workflow. It's a fork of VS Code that has a simpler UX and support for multiple cloud LLMs and custom models. Due to licensing, some Visual Studio Code extensions aren't available in Cursor.

For more information about Cursor, refer to the [Cursor Rules documentation](https://docs.cursor.com/).

## Claude Code

Claude Code is a terminal agent that supports custom instructions through memory files that guide AI behavior for coding tasks.

This is an advanced solution for technical users who like to work in the terminal. Unlike Visual Studio Code GitHub Copilot and Cursor, you only have access to Anthropic's models and no image support. Currently at Grafana we don't have subscription access to Claude.

For more information about Claude Code, refer to the [Claude Memory documentation](https://docs.anthropic.com/en/docs/claude-code/).

## OpenAI Codex CLI

OpenAI Cortex is another terminal agent that supports custom instructions through agent files that guide AI behavior for coding tasks.

This is an advanced solution for technical users who like to work in the terminal. Unlike Claude Code, with a ChatGPT Pro subscription, you can use OpenAI Cortex without going through API billing, which makes it significantly more cost-effective. With the release of GPT-5, it's a strong terminal agent to consider.

## Zed

Zed is a fast code editor with minimal UX and built-in agent that supports their AI subscription, cloud models via API access, custom models, and Gemini CLI and Claude Code as first party agents via [Agent Client Protocol](https://agentclientprotocol.com/overview/introduction) (ACP).

Zed supports many of the other editor agent instruction formats and works with the Docs AI toolkit.

## Other VS Code forks

There are many other Visual Studio Code forks like Cursor. They tend to offer subscription-based access for more affordable AI usage. Like other VS Code forks, they don't have access to all extensions.

Popular forks include:

- Windsurf
- Void

## Other API-based tools

There are many other tools, most require you to use them via API access, which is extremely expensive. For more information on why you should avoid using tools via API billing, refer to the [API billing documentation](billing.md).

Popular tools include:

- Cline: VS Code extension
- Roocode: VS Code extension
- Opencode: terminal agent
- Gemini CLI: terminal agent
- Zed: editor, that supports API agents

## Other tools

We don't currently have documentation to support asynchronous agents such as Google's Jules or OpenAI's Codex (different from Codex CLI).

We don't currently have documentation to support Warp terminal.


# Agent billing

At Grafana we have access to some agents through subscription models, for example, Google's Gemini and AI Studio, ChatGPT and OpenAI Codex CLI, GitHub Copilot, and Cursor.

We don't currently have subscription support for Claude and therefore Claude Code. To use Claude Code and many other agents with cloud models you need to provide API access.

API access is significantly more expensive.

Think carefully about whether the value you get from these agents justifies the cost. It's a matter of $20 versus thousands of dollars.

We highly recommend that you use agents with a subscription model. Many times you get access to the same models and request-based versus token-based billing that favors a more considered workflow with our instruction files, prompts, and planning complex tasks.


# Agent instructions

Think of agent instructions as a style guide for your AI coding assistant.

They're different from a prompt: the instruction is your set of reusable rules, while the prompt is the specific task you ask for right now.

You combine the two, providing the standing instructions and your specific prompt to get helpful and consistent answers every time.

The Docs AI Toolkit keeps these instructions organized in a central .docs/instructions/ folder, making them easy to find and use.

## What makes a good instruction

A good instruction has these qualities:

- **General**: Widely applicable rather than specific use cases
- **Concise**: Uses clear, direct language without unnecessary words
- **Positive**: Write "do this" instead of "don't do that"
- **Actionable**: Provides specific guidance that can be immediately applied

## Current instructions

We have the following agent-agnostic instructions for:

- Grafana technical writer role
- Grafana naming
- Style guide

## Future work

In future work we'll incorporate other generally applicable instructions from user feedback.


# Agent prompts

Think of a prompt as a specialized tool for a specific job, while an instruction is your general-purpose user manual.

A prompt is a set of directions you activate on-demand for a particular task, like drafting release notes. This is different from a general instruction, which provides the AI with your core, always-on rules.

By keeping these specialized prompts separate, you use the model's processing power (tokens) more efficiently and get better, more focused results.

The Docs AI toolkit establishes a convention of storing these prompts in a .docs/prompts/ folder, keeping them ready to be used when needed.

## Future work

In future work we'll include prompts for specific use cases, for example:

- Index and overview articles
- Introduction articles
- Setup articles
- Configuration sections
- Troubleshooting docs
- Release notes


## AI-as-code setup

For GitHub Copilot, Cursor, and other code editors.

### New repository

Copy the [`AGENTS.md`](https://github.com/grafana/docs-ai/blob/main/AGENTS.md) file to your repository root.

### Existing AGENTS.md file

Copy everything between the comments from the [docs-ai `AGENTS.md`](https://github.com/grafana/docs-ai/blob/main/AGENTS.md) file:

```markdown
<!-- docs-ai-begin -->

...content...

<!-- docs-ai-end -->
```

Paste this content between the same comments in your existing `AGENTS.md` file.

### Updating

Replace everything between `<!-- docs-ai-begin -->` and `<!-- docs-ai-end -->` comments with the latest content from the docs-ai repository.

### Custom instructions

Add your custom agent instructions outside the `<!-- docs-ai-begin -->...<!-- docs-ai-end -->` comments.

## Web-based AI setup

For Gemini, Google AI Studio, ChatGPT, and other web interfaces.

### Files needed

- [`AGENTS.md`](https://github.com/grafana/docs-ai/blob/main/AGENTS.md) - Core agent instructions
- [`DOCS.md`](https://github.com/grafana/docs-ai/blob/main/DOCS.md) - Complete toolkit documentation

### Setup steps

1. Open your web-based AI tool
2. Upload or paste the `AGENTS.md` file content
3. Add the `DOCS.md` file if you need toolkit documentation
4. Prompt the agent with your documentation task

## Next steps

- Read the [best practice workflows](workflows/_index.md)
- Review the [agent instructions](instructions/_index.md)
- Check the [AI Policy](https://wiki.grafana-ops.net/w/index.php/AI_Policy_FAQ)
- Request premium access: [GitHub Copilot](https://helpdesk.grafana.com/support/catalog/items/332) or [Cursor](https://helpdesk.grafana.com/support/catalog/items/379)


# AI best practice workflows

Docs are important. Technical content is often the first introduction customers get to our tools, products, and features, and also the first place they go to troubleshoot when things go wrong or they hit a barrier in Grafana products.

Usually the term best practice refers to a studied and verified approach to a task or discipline that has been created by experts in that field. In the case of AI and documentation, there really aren't any experts yet. The best practices listed below are from the personal and professional experience of those of us who have been using the tools and have determined what works best through experimentation over a period of months to a year. These approaches are not definitive, but they're effective. We offer our experiences as a jumping-off point, and as you evolve your own use of AI tools and workflows, we'll also evolve this guidance and the best practices will get better.

{{< section withDescriptions="true" >}}


# Create scenario documentation from customer calls

Customer calls are a goldmine of documentation insights, but manually extracting their value is a slow and difficult process. AI is the perfect tool to solve this, rapidly analyzing hours of conversation to surface the key pain points and the real world use cases that should drive our content.

This best practice covers how to use AI to turn customer calls into authentic scenarios and best practice content.

## Customer calls

Customer research, support calls, voice of the customer calls, and community calls are all examples of valuable user feedback. You can obtain transcripts either by feeding in audio or video, or copy/pasting the transcript directly into your AI tool.

As a first task, always prompt the agent to anonymize the content by scrubbing personal identifying information. This is important for data privacy, compliance, and security. You can then start to ask it to summarize the key points, focus on customer goals, their main challenges, and any workarounds.

### Prompts

```markdown
Act as a data privacy specialist. Please review the following customer call transcript and anonymize it. Replace all personal names with generic roles (e.g., 'the customer,' all company names with 'xxx'.)
```

```markdown
Summarize this customer call transcript. Identify the user's primary goal, the three main pain points they encountered, and the final resolution.
```

{{< admonition type="note" >}}
For added value, you can ask for a sentiment analysis.
{{< /admonition >}}

## Multiple sources

You can also feed the agent multiple transcripts and use AI to identify common themes and patterns. It can tell you which are mentioned most frequently, helping you prioritize what to document.

Start by anonymizing each transcript as above.

### Prompts

```markdown
Attached are five transcripts from customer calls about xxx. What are the most common questions and points of confusion across all of them?
```

Once you have the key painpoints, you can ask AI how the PM or engineers responded to them and ask it to write the first draft of a best practices or scenario based document.

```markdown
Based on the summary of the call, write a scenario document for a typical use case the customer would use xxx for. Use the persona of Sara, the Admin, use the company name Innovate Inc, use the team Developers in "Platform Engineering" team at Innovate Inc. and walk through the problem and the steps to solve it.
```

{{< admonition type="note" >}}
For better results, consider providing a template or example of how scenarios are documented at Grafana. This helps guide the AI to produce content that matches your preferred style and structure.
{{< /admonition >}}

```markdown
Create a best practices guide based on the solutions identified in this call transcript. Organize it using clear headings.
```


# Edit source content for style and grammar

This workflow helps you use AI agents to improve the grammar, style, and consistency of existing documentation while maintaining your content's technical accuracy and voice.

## Before you begin

Before you begin, ensure you have the following:

- Access to an AI agent (GitHub Copilot, Cursor, or web agent)
- The source content files you want to edit
- Understanding of your content's technical context

## Workflow overview

Follow this process for effective AI-assisted editing:

1. **Prepare your context** - Load style guides and source files
2. **Start with analysis** - Have the agent identify issues first
3. **Review suggestions** - Validate recommendations before applying
4. **Apply edits incrementally** - Work section by section for complex documents
5. **Verify technical accuracy** - Ensure AI hasn't changed meanings
6. **Test examples** - Confirm code samples and procedures still work

## Copy edit source content

Provide clear and simple instructions by specifying the action to perform, such as "copy edit to our style guide." Indicate the scope of the edit, for example, "this file" for the current context, "all the attached files" for multiple files, or reference a specific file using `@file_name`. Clearly state the expected outcomes, such as "improve grammar and fix spelling."

With the following prompt, the agent will edit the file and create a diff in the editor:

```markdown
Copy edit this file according to the Grafana style guide, improve grammar, and fix spelling.
```

### For larger documents

Break large documents into sections to maintain quality:

```markdown
Copy edit the "Installation" section of this file for grammar, clarity, and adherence to our style guide. Focus on improving sentence structure and consistency.
```

### For technical accuracy

When editing technical content, emphasize preserving accuracy:

```markdown
Copy edit this configuration guide for style and grammar while preserving all technical details, code examples, and parameter names exactly as written.
```

## Discuss improvements

You can also discuss the improvements and fixes before editing. The agent will give you a list of areas to address. You can then prompt it to fill in gaps or leave out certain actions. Finally, when you're happy, you can ask it to make its suggested changes.

```markdown
Discuss how we can improve the grammar and fix spelling errors while adhering to our style guide.
```

## Advanced editing techniques

### Structural improvements

For content that needs reorganization:

```markdown
Review this article's structure and suggest improvements to the heading hierarchy, paragraph organization, and information flow while maintaining all technical content.
```

### Voice and tone consistency

To align content with your brand voice:

```markdown
Adjust the tone of this document to be more conversational and user-friendly while maintaining technical accuracy. Focus on using active voice and second person perspective.
```

## Common issues and solutions

### AI changes technical terms

**Problem**: The agent modifies product names, API endpoints, or technical terminology.

**Solution**: Use more specific prompts:

```markdown
Copy edit for grammar and style only. Do not change any product names, API endpoints, code examples, or technical terminology.
```

### Overly formal language

**Problem**: AI makes content too formal or corporate.

**Solution**: Specify your desired tone:

```markdown
Edit this content for clarity and grammar while keeping a friendly, approachable tone. Use contractions and conversational language appropriate for developers.
```

### Loss of context

**Problem**: AI suggestions don't account for the broader document context.

**Solution**: Provide more context in your prompt:

```markdown
This is a troubleshooting guide for system administrators. Copy edit for clarity while maintaining the step-by-step instructional format and preserving all warning callouts.
```

## Next steps

After completing your style and grammar edits:

- Test any code examples or procedures mentioned in the edited content
- Share drafts with subject matter experts for technical review
- Consider running the content through additional AI workflows for structure or accessibility improvements
- Update related documentation that might reference the edited content


# Iterative content planning with AI

This workflow helps you create high-quality documentation through collaborative planning and iterative refinement with AI agents, rather than expecting perfect output from a single prompt.

Zero or one-shot prompts, such as simply asking "Write documentation for this feature," often lead to suboptimal results. These prompts set vague expectations, lack necessary context or constraints, and typically produce generic content that's difficult to refine or tailor to specific needs.

Iterative refinement allows you to improve content step by step, rather than aiming for perfection from the start. By planning collaboratively and incorporating your expertise, you ensure that each stage focuses on validated approaches. This method enables easy adjustments throughout the process, supporting more effective and adaptable execution.

## Before you begin

Before you begin, ensure you have the following:

- Access to an AI agent (GitHub Copilot, Cursor, or web agent)
- Source materials (code, screenshots, existing docs, requirements)
- Understanding of your target audience and their needs
- Time to work through multiple iterations (typically 3-5 rounds)

## Workflow overview

Follow this process for effective iterative planning:

1. **Define clear actions** - Specify what you want the AI to analyze or create
2. **Set scope and context** - Provide relevant materials and boundaries
3. **State expected outcomes** - Define what success looks like
4. **Discuss before executing** - Review suggestions and refine direction
5. **Plan collaboratively** - Create detailed plans together
6. **Iterate and improve** - Refine through multiple rounds

## Focus on actions and outcomes

Structure your initial prompts using clear actions, specific context, and defined outcomes. This approach ensures productive collaboration with AI agents and reduces the need for multiple clarification rounds.

Give clear and simple instructions:

- **Action to perform**: "analyze and suggest use case topics"
- **On what**: "this codebase and these application screenshots" (for current context) or @folder_name
- **Expected outcomes**: "3 use case topics to document"

### Basic action prompt

```markdown
Analyze this codebase and these application screenshots and suggest 3 use case topics to document.
```

### For targeted analysis

Focus the AI's analysis on specific user needs:

```markdown
Analyze this API documentation and suggest 3 tutorial topics for developers new to observability who need to implement monitoring in under 2 hours.
```

### For content gap identification

Direct the AI to identify specific documentation needs:

```markdown
Review this existing documentation and user feedback, then suggest 3 content gaps that would reduce the most common support requests.
```

## Discuss before doing

The agent will suggest priorities and identify gaps. You can then ask for more details on specific sections, request alternative approaches, or clarify requirements or constraints.

### Discussion prompt

```markdown
Where do these use cases fit into the user's onboarding journey, how easy or complex are they?
```

### For alternative approaches

Get different perspectives on the same problem:

```markdown
Suggest 2 different content strategies for this feature: one focused on quick implementation and another for comprehensive understanding.
```

### For requirement clarification

Refine scope and constraints:

```markdown
Which of these topics would require input from the engineering team versus what we can document with existing resources?
```

## Plan the project together

The following prompt gives you a structured approach, an opportunity to review before full execution, and control over scope and direction.

### Planning prompt

```markdown
Create the first draft of a detailed plan for the X use case topic we can discuss and iterate on.
```

### For comprehensive planning

Get detailed project breakdowns:

```markdown
Create a content plan for [topic] including outline, required resources, timeline, and review checkpoints.
```

### For iterative development

Plan content in phases:

```markdown
Break this documentation project into 3 phases: basic implementation, advanced features, and troubleshooting. Provide a plan for each phase.
```

## Advanced techniques

### Content validation

Test your plans before execution:

```markdown
Review this content plan and identify potential issues with user flow, missing prerequisites, or technical accuracy concerns.
```

### Integration planning

Connect new content with existing documentation:

```markdown
Analyze how this new content fits with our existing documentation structure and suggest the best integration points.
```

### Feedback incorporation

Use existing user feedback to guide planning:

```markdown
Based on these support tickets and user feedback, prioritize which aspects of this feature need the most detailed documentation.
```

## Common issues and solutions

### Vague requirements

**Problem**: Planning produces generic or unfocused suggestions.

**Solution**: Add specific constraints and context:

```markdown
Plan documentation for users migrating from [specific tool] to our platform, focusing on the differences in workflow and configuration.
```

### Scope creep

**Problem**: Plans become too ambitious or complex.

**Solution**: Set clear boundaries:

```markdown
Focus this plan on the core workflow only. Advanced configurations and edge cases will be separate documentation.
```

### Missing user perspective

**Problem**: Plans don't address real user needs.

**Solution**: Include user context explicitly:

```markdown
Plan this content for developers who have never used observability tools before and need to understand both concepts and implementation.
```

## Next steps

After completing iterative planning:

- Begin content creation using your detailed plan as a guide
- Schedule regular check-ins to validate progress against user needs
- Test content structure with team members before full execution
- Document lessons learned to improve future planning processes


# Create new product or feature documentation

Creating documentation for a new feature from scratch can be a time-consuming process. AI can accelerate this workflow by taking your raw notes, product plans, and style guides and generating a complete, well-structured first draft.

This best practice covers how to use AI to turn source materials into a high-quality initial draft for either a new feature or product.

## Prompt

```markdown
I have uploaded three files: a style guide, a document template, and my raw notes.

Act as an expert technical writer. Your task is to generate a complete first draft of the documentation based on my notes using the attached style guide and template.

Audience: This document is for [admins].

Goal: After reading this document, [an admin] should be able to [xxx].

Scope & Structure: Define the feature or product. Add an introduction, how it works, and a workflow section. Create task topics for how users would use the product or feature.

[Adapt this section according to the type of documentation you are writing. Product DNAs, screenshots help with context. The more context, the better the initial draft.]

Tone: Keep the tone friendly and encouraging.
```


# Continuous quality evaluation using AI personas

Set up a continuous feedback loop to keep your docs improving by using AI agents that act like a team of reviewers with different specialties.

These agents help spot and fix issues by checking your docs against important quality criteria for different types of users.

Instead of waiting for occasional human reviews, you get ongoing, consistent, and scalable feedback from AI agents, each with their own focus.

Your virtual review team has three main roles:

## The Critic

To analyze the fundamental quality of the writing. It acts as a meticulous peer reviewer, checking for clarity, conciseness, tone, and structural integrity.

### Prompt

```markdown
Act as a senior technical writer. Review the attached document for clarity, conciseness, and adherence to our style guide. Identify any confusing sentences, undefined jargon, or structural issues.
```

## The Questioner

To determine if the documentation answers the questions users are likely to have. It reads a document and generates a list of questions that a curious user would ask.

### Prompt

```markdown
Based on the attached document about 'Adaptive Logs', generate 10 distinct questions a new user is likely to have. The questions should cover what the feature is, why it's useful, and how to get started.
```

## The User

To test if a specific user type can succeed with the documentation. You create multiple flavors of this agent, each modeled on one of your key user profiles (e.g., beginner, admin, etc.). This agent is given the questions from "The Questioner" and tries to find the answers in the documentation.

### Prompt

```markdown
Act as a beginner user who is not a developer. I will provide a document and a list of 10 questions. For each question, state whether you found a 'Clear Answer', 'Partial Answer', or 'No Answer' within the provided text. If you found the language too technical to understand, note that.
```

You can track the results in a spreadsheet and use them as benchmarks. If the success rate falls below 80%, you can flag an area as a candidate for improvement and open an issue or discuss priorities with the PM.


# Continuous feedback and sentiment analysis

Focus your attention and improve the quality of documentation by directly acting on high-signal, actionable feedback from the communities where your users are having organic conversations.

You can structure your prompt to do two or more things. The prompt below lets you set up the following alert cadences:

1. **A focused daily alert**: Create a primary daily alert that targets a specific list of high-value sites where your users are most active. This gives you your core, actionable feedback.
1. **A broad weekly, monthly, or quarterly alert**: Keep a secondary, broader search that runs weekly. Its purpose is to catch mentions from new blogs or forums you might want to add to your primary list.

```markdown
Set up a daily, weekly, monthly, or quarterly alert to search (site:reddit.com/r/grafana OR site:reddit.com/r/devops OR site:stackoverflow.com OR site:community.grafana.com) for new conversations from [the past 24 hours] about Grafana's [Adaptive Telemetry] products.

For each conversation, perform a detailed analysis on:

- Overall sentiment
- Usability and UX feedback
- Documentation feedback

Summarize the findings and flag any urgent issues.
```


# Content optimization and SEO with AI

To make your documentation more easily findable by AI, you must shift your thinking from traditional keyword SEO to a more holistic approach focused on semantic context and structured data.

AI doesn't "read" your website like a human. Instead, systems like Retrieval-Augmented Generation (RAG) break your documentation into smaller "chunks," convert them into numerical representations of their meaning (embeddings), and store them in a database. When a user asks a question, the AI finds the most semantically relevant chunks to construct its answer.

## Key principles for high retrievability

We do a lot of this already, but there are some improvements we can look at as people shift to using AI as the main starting point for searching for information.

What we do well:

- Consistently use a logical heading structure (H1 for the main title, followed by H2s for major sections, then H3s for sub-sections)
- Write clear, unambiguous language
- Interlinking between related topics

Things we could do better:

- High quality metadata
- Atomic pages

## Use high quality metadata

AI aims to identify the most relevant and trustworthy topic that precisely addresses the user's question. By enhancing our documentation with effective SEO practices and comprehensive metadata, we provide clear signals that help AI systems accurately assess and surface the best content for each query.

### Add better descriptions

Clear, detailed descriptions bridge the gap between a user's question and your feature's solution. Well-crafted descriptions boost the AI's confidence in your content, making it more likely to be selected as a reliable source. To improve your metadata:

- **Include a review date:** Signals the topic’s freshness and reliability to both AI and human readers.
- **Specify the intended audience:** Helps AI tailor responses to the appropriate knowledge level.
- **Define relevant personas:** Adds context, enabling AI to provide answers that align with different user roles and goals.

## Create shorter, atomic pages

Dividing lengthy documentation into concise, atomic topics,each centered on a single concept, improves AI retrieval, even if your heading structure is already well-organized.
| | **Long page with good headings** | **Short, focused pages** |
| :--- | :--- | :--- |
| **AI retrieval confidence** | Moderate to high. The AI can identify a relevant section using headings and extract the associated content, but may be less certain about the overall page relevance. | Very high. The AI recognizes that the entire page directly addresses the user's query, allowing it to return the whole document as a highly relevant answer. |

## Use AI as your SEO consultant

You can use AI to act as your SEO consultant and give feedback on how to optimize your content for AI.

### Prompt

```markdown
Act as an SEO specialist reviewing this documentation topic in Grafana. My primary target keyword is "Adaptive Logs."

Analyze the following topic (set of topics) and provide feedback on these four points:

- Keyword usage: Is the primary keyword present and used naturally in the main title (H1) and at least one subheading (H2)?
- Meta description: Write a compelling, SEO-friendly meta description (under 160 characters) that includes the primary keyword.
- Heading structure: Is the heading structure logical (i.e., no H3s without an H2 above it)?
- Readability: Are there any sentences that are overly long or complex that could be simplified for better readability?
```


# Use AI for fewer (and shorter) demos and meetings with SMEs

Use AI to shorten meetings with your SMEs to make your interviews more productive by handling the preparation and analysis. The key is to use AI before the interview to do your homework and prepare targeted questions, and after the interview to extract key information and action items.

## Before the interview

Use AI to analyze all the existing source material (product dna, design docs, engineering notes, even code comments).

### Prompt

```markdown
Act as a technical writer. You´re preparing to interview an engineer about the new 'xxx' feature. Attached is the Product DNA, design doc, and some engineering notes. Based on this, generate a list of 5-7 specific, technical questions I should ask to understand how to document this feature for a developer audience. Focus on potential points of confusion or gaps in the existing material.
```

## After the interview

Record the interview and use AI to process the transcript. Pull the most important information, structure it, and identify any remaining questions.

### Prompt

```markdown
Analyze this interview transcript. My goal is to understand the configuration process. Extract the key, step-by-step instructions the SME provided into a numbered list. Create a list of any action items, so I can follow up asynchronously.
```

