Triaging of issues
------------------

Grafana being a popular open source project there are a lot of incoming issues. The main goal of issue triage is to categorize all incoming issues and make sure it has all basic information needed for anyone else to understand and/or being able to start working with it.

The core maintainers of the Grafana project is responsible for categorizing all incoming issues and delegate any critical and/or important issue to other maintainers. Currently there's one maintainer each week responsible. Besides that part, triage provides an important way to contribute to an open source project. Triage helps ensure issues resolve quickly by:

* Describing the issue's intent and purpose is conveyed precisely. This is necessary because it can be difficult for an issue to explain how an end user experiences a problem and what actions they took.
* Giving a contributor the information they need before they commit to resolving an issue.
* Lowering the issue count by preventing duplicate issues.
* Streamlining the development process by preventing duplicate discussions.
* If you don't have the knowledge or time to code, consider helping with triage. The community will thank you for saving them time by spending some of yours.

## 1. Find uncategorized issues

To get started with issue triage and finding issues that haven't been triaged you have two alternatives.

### Browse unlabeled issues

The easiest and straigt forward way of getting started and finding issues that haven't been triaged is to browse [unlabeled issues](https://github.com/grafana/grafana/issues?q=is%3Aopen+is%3Aissue+no%3Alabel) and starting from the bottom and working yourself to the top.

### Subscribe to all notifications

The more advanced, but recommended way is to subscribe to all notifications from this repository which means that all new issues, pull requests, comments and important status changes are sent to your configure email address. Read this [guide](https://help.github.com/en/articles/watching-and-unwatching-repositories#watching-a-single-repository) for help with setting this up.

It's highly recommened that you setup filters to automatically remove emails from the inbox and label/categorize them accordingly to make it easy for you to understand when you need to act upon a notification or where to look for finding issues that haven't been triaged etc.

Instructions for setting up Gmail filters can be hound [here](#-setting-up-gmail-filters).

## 2. Ensure the issue contains basic information

Before triaging an issue very far, make sure that the issue's author provided the standard issue information. This will help you make an educated recommendation on how to categorize the issue. The Grafana project utilizes [GitHub issue templates](https://help.github.com/en/articles/creating-issue-templates-for-your-repository) to guide  contributors to provide standard information that must be included for each type of template or type of issue, see details [here](#standard-issue-information).

Depending on the issue, you might not feel all this information is needed. Use your best judgement. If you cannot triage an issue using what its author provided, explain kindly to the author that they must provide the above information to clarify the problem. Label issue with `needs more detail` and add any related `area/*` or `datasource/*` labels.

If the author provides the standard information but you are still unable to triage the issue, request additional information. Do this kindly and politely because you are asking for more of the author's time.

If the author does not respond requested information within the timespan of a week, close the issue with a kind note stating that the author can request for the issue to be reopened when the necessary information is provided.

**Some general rule of thumbs to make it easier for everyone to understand and find issues they're searching for:**
* Make sure that issue titles are named to explain the subject of the issue, has a correct spelling and and doesn't include irrelevant information.
* Make sure that issue descriptions doesn't include irrelevant information and/or information from template that haven't been filled out.
* Make changes to title and description as you see fit or request suggested changes in a comment.
* Above is applicable to both new and existing issues of the Grafana project.

## 3. Categorizing an issue

An issue can have multiple of the following labels. Typically, a properly classified issue should have:

* One label identifying its type (`type/*`).
* One or multiple labels identifying the functional areas of interest or component (`area/*`) and/or core datasource (`datasource/*`).
* Where applicable, one label categorizing its difficulty (exp/*).

### type/question

A question about how to use Grafana or a specific datasource.  We preferably want these types of issue on the [community site](https://community.grafana.com/).

**Actions:**
* Kindly and politely direct the user to the community site and optionally answer if applicable and close the issue.
* Label issue with `type/question`

### type/bug

A feature isn't working as expected given design or documentation.

**Actions:**
* Check for duplicates
* If not perfectly clear that it's a bug, quickly try to reproduce it.
  * If not reproduceable, ask for more information
* Label issue with `type/question`

Type | Description
------- | --------
type/bug | a feature isn't working as expected given design or documentation
type/feature-request | request for a new feature or enhancement
type/accessibility | accessibility problem or enhancement
type/question | a duplicate issue of the same subject have already been open
type/duplicate | issue is a duplicate of an existing issue
type/works-as-intended | a reported bug works as intended/by design

## Investigation of issues

When an issue has all basic information provided, but the triage responsible haven't been able to reproduce the reported problem at a first glance, the issue is labeled [Needs investigation](https://github.com/grafana/grafana/labels/needs%20investigation). Depending of the perceived severity and/or number of upvotes, the investigation will either be delegated to another maintainer for further investigation or either put on hold until someone else (maintainer or contributor) picks it up and eventually start investigating it.

Investigating issues can be a very time consuming task, especially for the maintainers given the huge number of combinations of plugins, datasources, platforms, databases, browsers, tools, hardware, integrations, versions and cloud services etc that are being used with Grafana. There are a certain amount of combinations that are more common than others and these are in general easier for maintainers to investigate.

For some other combinations there may not be possible at all for a maintainer to setup a proper test environment for being able to investigate. In these cases we really appreciate any help we can get from the community. Otherwise the issue is highly likely to be closed.

Even if you don't have the time or knowledge to investigate an issue we highly recommend that you [upvote](http://link-here) the issue if you happen to have the same problem. If you have further details that may help investigating the issue please provide as much information as possible.


## Appendix

### Setting up Gmail filters

If you're using Gmail it's highly recommened that you setup filters to automatically remove email from the inbox and label them accordingly to make it easy for you to understand when you need to act upon a notification or process all incoming issues that haven't been triaged.

This may be setup by personal preference, but here's a working configuration for reference.
1. Follow instructions in [gist](https://gist.github.com/marefr/9167c2e31466f6316c1cba118874e74f)
2. In Gmail, go to Settings -> Filters and Blocked Addresses
3. Import filters -> select xml file -> Open file
4. Review filters
5. Optional, Check Apply new filters to existing email
6. Create filters

This will give you a structure of labels in the sidebar similar to the following:
```
 - Inbox
 ...
 - Github (mine)
   - activity
   - assigned
   - mentions
 - Github (other)
  - Grafana
```

* All notifications you’ll need to read/take action on shows up as unread in Github (mine) and its sub-labels.
* All other notifications you don’t need to take action on shows up as unread in Github (other) and its sub-labels
  * This is convenient for issue triage and to follow the activity in the Grafana project.

### Standard issue information

Given a certain [issue template]([template](https://github.com/grafana/grafana/issues/new/choose)) have been used by the issue author or how the issue is perceived by the issue triage responsible, the following should help you understand what standard issue information that must be included.

#### Bug report?

Should explain what happened, what was expected and how to reproduce it together with any additional information that may help giving a complete picture of what happened such as screenshots, [query inspector](https://community.grafana.com/t/using-grafanas-query-inspector-to-troubleshoot-issues/2630) output and any environment related information that's applicable and/or maybe related to the reported problem:
- Grafana version
- Data source type & version
- Platform & OS Grafana is installed on
- User OS & Browser + versions
- Using docker + what environment
- Which plugins
- Configuration database in use (sqlite, mysql, postgres)
- Any reverse proxy in front of Grafana
- Non-default configuration settings

#### Enhancement request?

Should explain what enhancement or feature that the author wants to be added and why that is needed.

#### Accessibility issue?

This is a mix between a bug report and enhancement request but focused on accessibility issues to help make Grafana improve keyboard navigation, screen-reader support and being accessible to everyone. The report should include relevant WCAG criteria, if applicable.

#### Support request?

In general, if the issue description and title is perceived as a question no more information is needed.