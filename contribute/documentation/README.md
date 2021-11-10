
# Contribute to Grafana documentation

This guide...

## Welcome

xxxxx


### Intended audience

The intended audience for this documentation includes Grafana open source community contributors.

## Understanding the structure of Grafana documentation

All Grafana Enterprise and OSS documentation is located in the [Grafana open source project](https://github.com/grafana/grafana) GitHub repository: https://github.com/grafana/grafana/tree/main/docs/sources.

- The **sources** directory organizes content by topic areas, for example **administration** and **alerting**. 
- Topic directories include an `_index.md` file, which provides an overview of the topic, and optionally includes subtopics that provide more detail.

:::note
The `_index.md` file is required.
:::

## Ways to contribute

We're thrilled that you are considering contributing to the documentation. You can contribute content in the following ways:

- [Request a change](#request-a-change)
- [Edit a topic](#edit-a-topic)
- [Write a topic](write-a-topic)

### Request a change

Request a change when you want to make a suggestion about a topic, but don't want to provide an edit that generates a pull request. Requesting a change gives you the freedom to express your ideas without committing language. Your suggestion can reflect a small change to wording or can reflect larger, more substantive changes.

GitHub captures your request as an **Issue** logged against the repository.

Before you begin:
- Create a GitHub account. 

To request a change, complete the following steps:

1/ While viewing the topic, click **Request a change**.

   The Issue title auto-populates with the location of the file about which you are requesting a change.

![Request a change](request-change.png)

1/ Enter a change request description.

1/ Add the **type/docs** label.

1/ Click **Submit new issue**.

### Edit a topic

If you want to recommend a small change, such as suggesting alternative wording to language within a topic, you can edit the topic directly in GitHub. You are not required to fork and clone the repo to use this approach.

Other small changes might include:

- Adding steps to a task
- Adding clarifying language to a concept
- Providing an example

Before you begin:

- Create a GitHub account. 

To edit a topic, complete the following steps:

1/ While viewing the topic you want to edit, click **Edit this page**.

![Edit a topic](edit-file.png)

1/ Add your changes to the topic.

1/ Scroll to the bottom of the page and enter a branch name.
   
   For example, enter `clarified dashboard panel definition`.

1/ Click **Commit**.

   GitHub prompts you to create a PR.

1/ Complete the prompts provided in the body of the PR.

1/ Click **Create pull request**.

### Write a topic

At Grafana Labs, we use the principles of topic-based authoring when we write technical documentation. Topic-based authoring provides guidelines for writing three *types* of technical documentation: concept, task, and reference. Before you begin writing, establish the topic type you want to write.

#### Understanding topic types

Technical content is divided into three topic types: concept, task, and reference.

- **Concept**: A concept topic explains *what* a feature (or idea) is, and why it is important.
- **Task**: A task topic explains *how* to complete an end user procedure in the system. Task topics contain steps.
- **Reference** A reference topic contains lookup information that a user might consult when they complete a task. Documenting a list of values with descriptions is a common form of reference topic.

**Example**

Suppose you are writing content for a site called _Doggie handbook_. You might organize your topics like this: 

**Concepts**

- What a dog is
- Brief history of dogs
- Why you might want a dog
- Tasks dogs can be trained to do

**Tasks**

- Feed the dog
- Groom the dog
- Train the dog

**References**

- List of dog equipment you will need
- Table of breeds that includes breed name, size range, short or long hair, and type of dog

#### Prepare your environment

Before you begin writing, we recommend that you fork and clone the Grafana repository so that you can use a text editor locally to create branches, commit your changes, and create a PR.

While this document doesn't include git commands or descriptions of Github operations, you might find these links useful.

- [Install git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git): We store all source code, including documentation, in Git repositories.
- [Fork a repo](https://docs.github.com/en/get-started/quickstart/fork-a-repo): Locate the repo you want to clone, and fork it.
- [Clone a repo](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository): Clone the repository to your local machine.
- [Create a branch](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging): Before you make change, create a branch. Do not push changes against the `main` branch.
- [Create a PR](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request): After you add, commit, and push your changes, create a PR in Github.

#### Use a documentation template to contribute a topic

We have provided documentation templates that align with each topic type:

- [Concept](../templates/doc-concept-template.md)
- [Task](../templates/doc-task-template.md)
- [Reference](../templates/doc-reference-template.md)

Each template provides additional usage and formatting guidelines. We recommend that you make a copy of whichever template you are using, and add content.

:::note
Remove any unused content before you commit your changes.
:::


#### View a local build

Prior to pushing your changes, you can view a local build of the documentation so that you can review your work.

To view a local build:

1/ Install [Docker](https://www.docker.com/products/docker-desktop).

1/ Run Docker.

1/ Navigate to the **docs** root directory.

1/ Run `make build`.

1/ Open `localhost:3002` to review your changes.

## Push changes and create a PR

When you are ready for other people to review your work, perform the following tasks.

1/ [Add](https://git-scm.com/docs/git-add) your changes, which prepares your content for the next commit.

1/ [Commit](xxx) your changes.

1/ [Push](https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository) your changes to Github.

1/ [Create a PR](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) in Github.

   The docs build system automatically conducts a series of tests to ensure that the content doesn't conflict with other content in the docs repository.

### Understanding the PR review and approval workflow

Need content here that describes where to post PR for review, of whom to select for a review, review SLA?, and what the review process is like. This doesn't have to be long.

## Join our community

For general discussions on documentation, you’re welcome to join the `#docs` channel on our [public Grafana Slack](http://slack.raintank.io) team.

## Reference: Top five writing tips

Consult the following guidelines before you begin writing. 

### Consider the audience

Write for an audience that is computer literate and has general technical knowledge, but is not necessarily familiar with Grafana or the finer points of observability.

Pretend you are explaining your topic to a brand new Grafana user or developer.

### Write clear and concise sentences and paragraphs

xxx.

### Use active voice

xxx.

### Avoid obscure non-English words and abbreviations

xxx.

### Write self-contained topics

Thanks to search engines, every page in the documentation might be a reader's entry point. This means that each page needs to be self-contained and make sense on its own. The reader should not need to read other topics in order to perform the task or understand the concept.

However, try to be helpful and link to related information. Using the _Doggie handbook_ example, the concept topic that explains what dogs can be trained to do might link to the Train the dog task.
